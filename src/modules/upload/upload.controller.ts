import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
// import type { Express } from 'express';

const PARTNER_COVER_FOLDER = /^partners\/[0-9a-f-]{36}$/i;
const UUID_FOLDER = /^[0-9a-f-]{36}$/i;

function resolveUploadFolder(raw: string | undefined): string {
  const folder = raw?.trim();
  if (!folder) {
    return 'cars';
  }
  if (PARTNER_COVER_FOLDER.test(folder)) {
    return folder;
  }
  // Legacy: allow bare companyId → partners/{id}
  if (UUID_FOLDER.test(folder)) {
    return `partners/${folder}`;
  }
  throw new BadRequestException('Invalid upload folder');
}

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folderQuery?: string,
  ) {
    const folder = resolveUploadFolder(folderQuery);
    if (folder.startsWith('partners/')) {
      await this.cloudinaryService.ensureFolder(folder);
    }
    const result = await this.cloudinaryService.uploadImage(file, folder);
    return { url: result.secure_url, folder };
  }
}
