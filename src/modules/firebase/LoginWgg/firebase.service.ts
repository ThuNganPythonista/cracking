// firebase-admin.service.ts
import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FirebaseAdminService {
  constructor() {
    const serviceAccount = require('/Users/mac/Documents/cracking2/quiz/zhu-zhu-b4c42-firebase-adminsdk-uxn3k-1ed80268dd.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  async verifyIdToken(idToken: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken; // trả lại in4 user nếu token đúng
    } catch (error) {
      throw new Error('Unauthorized');
    }
  }

  getAdminApp(): admin.app.App {
    return admin.app(); // Trả về ứng dụng Firebase đã khởi tạo
  }
}