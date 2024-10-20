import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private secretNumber: number;

  constructor() {
    this.secretNumber = 21;
  }

  guessNumber(userGuess: number, playerName: string): string {
    if (userGuess === this.secretNumber) {
      const nameToDisplay = playerName ? playerName : 'bạn gì đó ơi';
      const message = `Chúc mừng ${nameToDisplay}! Bạn đã đoán đúng số. Trò chơi kết thúc!`;
      return message;
    } else if (userGuess < this.secretNumber) {
      return 'Gợi ý : số đúng là tổng số lượng các chữ cái trong câu hỏi, không bao gồm khoảng cách và "Câu hỏi:" !! Số của bạn đang nhỏ hơn';
    } else {
      return 'Gợi ý : số đúng là tổng số lượng các chữ cái trong câu hỏi, không bao gồm khoảng cách và "Câu hỏi:" !! Số của bạn đang lớn hơn';
    }
  }

  getCurrentNumber(): number {
    return this.secretNumber;
  }
}
