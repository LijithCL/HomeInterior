import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from './uploads.service';

@Controller()
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly storage: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('uploads/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const key = await this.uploadsService.saveImage(file, 'asset-thumb');
    return { key, url: this.storage.getSignedUrl(key) };
  }

  // Deliberately not behind JwtAuthGuard: an <img src> can't attach an
  // Authorization header, so this route is protected by a signed, expiring
  // query-string token instead (see StorageService.getSignedUrl).
  @Get('uploads/:key')
  async download(
    @Param('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!exp || !sig || !this.storage.verify(key, Number(exp), sig)) {
      throw new UnauthorizedException('Invalid or expired download link');
    }

    try {
      const data = await this.storage.read(key);
      res.setHeader('Content-Type', this.uploadsService.contentTypeFor(key));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(data);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
