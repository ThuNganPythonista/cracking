import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { User } from '../models/user.schema';
import { CreateUserDto } from '../dto.all.ts/users/register.dto';
import { ResetPasswordDto } from '../dto.all.ts/users/reset-password.dto';
import { Types } from 'mongoose';
import { validateUserInput } from '../../shared/utils/validateUserInput';
import { isRateLimited } from '../../shared/utils/rate-limit.util';
import { RSAUtils } from '../../shared/utils/RSAUtils';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

@Injectable()
export class UsersService {
  private failedAttempts = new Map<
    string,
    { attempts: number; blockUntil: Date }
  >();
  private oauth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
     this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI') 
    );

    this.oauth2Client.setCredentials({
      refresh_token: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
    });
  }

  async register(createUserDto: CreateUserDto): Promise<Object> {
    const { username, password, securityAnswer } = createUserDto;

    validateUserInput(username, password);

    const existingUser = await this.userModel.findOne({ username });
    if (existingUser) throw new BadRequestException('Tài khoản đã tồn tại');

    const hashedPassword = await bcrypt.hash(password, 10);

    const encryptedAnswer = RSAUtils.encryptWithPublicKey(securityAnswer, path.join(__dirname, '../../../publicKey.pem'));


    const newUser = new this.userModel({
      username,
      password: hashedPassword,
      answer_security: encryptedAnswer,
      role: 'user',
  
    });

    await newUser.save();

    return {
      name: newUser.username,
    };
  }

private async sendOtpToEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.configService.get<string>('GMAIL_EMAIL'), 
          clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          refreshToken: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
          accessToken: accessToken.token, 
        },
      });

      // Email options
      const mailOptions = {
        from: `"Shiso" <${this.configService.get<string>('GMAIL_EMAIL')}>`,
        to,
        subject,
        text,
        html,
      };

      // Send email
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
}
  // LẤY MÃ Ô TÊ PÊ theo múi giờ csdl
  async getOtp(
  username: string,
): Promise<any> {
  const user = await this.userModel.findOne({ username });
  if (!user) {
    throw new UnauthorizedException('Người dùng không tồn tại');
  }

  // Check rate limit with UTC time
  const rateLimitMinutes = 1;
  const now = Date.now();

  if (isRateLimited(user.lastOtpRequest, rateLimitMinutes)) {
    throw new BadRequestException(
      `Bạn chỉ có thể yêu cầu mã OTP mỗi ${rateLimitMinutes} phút`,
    );
  }

  const check = user.answer_security;
  console.log(check);
  const decryptedAnswer = RSAUtils.decryptWithPrivateKey(user.answer_security, path.join(__dirname, '../../../privateKey.pem'));


  const otp = speakeasy.totp({
    secret: process.env.OTP_SECRET,
    encoding: 'base32',
  });

  user.otp = otp;
  user.otpExpires = new Date(now + 5 * 60 * 1000); 
  user.lastOtpRequest = new Date(now);

  await user.save();
  return await this.sendOtpToEmail(decryptedAnswer,"Shiso sends OTP to you", otp); 

  
}


  private handleFailedAttempt(username: string): void {
    const MAX_ATTEMPTS = 5;
    const BLOCK_DURATION = 5 * 60 * 1000; // 5 phút
    const now = new Date();

    let userAttemptData = this.failedAttempts.get(username);

    if (!userAttemptData) {
      userAttemptData = { attempts: 1, blockUntil: null };
    }

    if (userAttemptData.blockUntil && userAttemptData.blockUntil > now) {
      throw new BadRequestException(
        `Tài khoản ${username} bị tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.`,
      );
    }

    userAttemptData.attempts += 1;

    if (userAttemptData.attempts >= MAX_ATTEMPTS) {
      userAttemptData.blockUntil = new Date(now.getTime() + BLOCK_DURATION);
    }

    this.failedAttempts.set(username, userAttemptData);
  }

  async validateUser(username: string, password: string): Promise<any> {
  const now = new Date();

  // Xử lý giới hạn số lần đăng nhập sai
  this.handleFailedAttempt(username);

  const user = await this.userModel.findOne({ username });

  if (user && (await bcrypt.compare(password, user.password))) {
    if (!user.isVerified) {
      throw new BadRequestException('Tài khoản chưa được xác thực. Vui lòng xác thực tài khoản trước.');
    }

    // Xóa số lần đăng nhập thất bại sau khi thành công
    this.failedAttempts.delete(username);

    const payload = {
      username: user.username,
      sub: user._id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  } else {
    throw new BadRequestException('Tên tài khoản hoặc mật khẩu không đúng');
  }
}

  async verifyOtp(username: string, otp: string, password?:string): Promise<any> {
    const user = await this.userModel.findOne({ username });
    if (!user || !user.otp || !user.otpExpires) {
      throw new BadRequestException({
        message: 'Invalid OTP',
      });
    }

    if (new Date() > user.otpExpires) {
      throw new BadRequestException({
        message: 'OTP expired',
      });
    }

    const isValidOtp = speakeasy.totp.verify({
      secret: process.env.OTP_SECRET,
      encoding: 'base32',
      token: otp,
      window: 1,
    });

    if (isValidOtp) {
      if (password) {
      const hashedPassword: string = await bcrypt.hash(password, 10); 
      user.password = hashedPassword;
      await user.save(); 
      }
      user.isVerified = true;
      const payload = { username: user.username, sub: user._id };
      const token = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      return { access_token: token, refresh_token: refreshToken };
    } else {
      throw new BadRequestException('Invalid OTP');
    }
  }

  
  // async func này dùng để DI vào refresh token service bên file khác.
  async invalidateRefreshToken(refreshToken: string): Promise<void> {
    await this.userModel.updateOne(
      { 'refreshTokens.token': refreshToken },
      { $set: { 'refreshTokens.$.isActive': false } },
    );
  }
  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  // reset password (check username, securityAnswer, thế new password vào user.password)
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<string> {
    const { username, newPassword, securityAnswer } = resetPasswordDto;
    const now = Date.now();

    const user = await this.userModel.findOne({ username });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const isAnswerCorrect = await bcrypt.compare(
      securityAnswer.toString(),
      user.answer_security,
    );
    if (!isAnswerCorrect) {
      throw new BadRequestException('Câu trả lời không chính xác');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

     const otp = speakeasy.totp({
      secret: process.env.OTP_SECRET,
      encoding: 'base32',
    });

    user.otp = otp;
    user.otpExpires = new Date(now + 5 * 60 * 1000);
    user.lastOtpRequest = new Date(now);

    await user.save();


    return otp;
  }

  // Tạo admin

  async createAdmin(createUserDto: CreateUserDto): Promise<string> {
    const { username, password, securityAnswer } = createUserDto;

    const existingUser = await this.userModel.findOne({ username });
    if (existingUser) {
      throw new BadRequestException('Tài khoản đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toString(), 10);

    const newUser = new this.userModel({
      username,
      password: hashedPassword,
      answer_security: hashedAnswer,
      role: 'admin', // Đặt role là admin
    });
    await newUser.save();

    return `Chúc mừng ${newUser.username}, bạn đã được tạo thành công với vai trò admin!`;
  }

  async deleteUser(
    userId: Types.ObjectId,
    targetDelete: Types.ObjectId,
  ): Promise<string> {
    const admin = await this.userModel.findById(userId);
    const user = await this.userModel.findById(targetDelete);

    if (!user || !admin) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    if (user.role === 'user' && userId._id === targetDelete._id) {
      await this.userModel.findByIdAndDelete(targetDelete);
      return 'bạn đã xóa tài khoản này với tư cách là chủ sỡ hữu tài khoản';
    }
    if (user.role === 'admin') {
      await this.userModel.findByIdAndDelete(targetDelete);
      return 'Bạn đã xóa tài khoản này với tư cách là admin';
    }

    if (user.role === 'user' && userId._id !== targetDelete._id) {
      return 'bạn không phải Admin để xóa tài khoản của người khác và cũng không phải chủ sở hữu tài khoản';
    }
  }

  
}
