import { Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { v2 as Cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('Cloudinary') private cloudinary) {}

  async uploadImage(
    file: Express.Multer.File,
    folder = 'cars',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.cloudinary.uploader
        .upload_stream({ folder }, (error, result) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          if (error) return reject(error);
          resolve(result);
        })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .end(file.buffer);
    });
  }

  async ensureFolder(folderPath: string): Promise<void> {
    // If folder already exists Cloudinary returns an error; ignore it.
    // Also guard against long network hangs to avoid blocking core API flows.
    try {
      const createFolderPromise: Promise<unknown> =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.cloudinary.api.create_folder(folderPath);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('cloudinary_create_folder_timeout')), 3000),
      );
      await Promise.race([createFolderPromise, timeoutPromise]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('already exists')) return;
      console.warn(`[Cloudinary] ensureFolder skipped: ${folderPath} (${message})`);
    }
  }

  async deleteImage(publicId: string): Promise<any> {
    // TODO: not working removing image from cloudinary
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await this.cloudinary.uploader.destroy(publicId);
  }

  getPublicIdFromUrl(url: string): string {
    // Example Cloudinary URL: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image-name.jpg
    const parts = url.split('/');
    const fileName = parts.pop()!.split('.')[0]; // remove extension
    const folder = parts.slice(parts.indexOf('upload') + 1).join('/');
    return `${folder}/${fileName}`;
  }
}
