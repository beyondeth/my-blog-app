import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3Service } from './services/s3.service';
import { File } from './entities/file.entity';
import s3Config from '../config/s3.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([File]),
    ConfigModule.forFeature(s3Config),
  ],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService, S3Service],
})
export class FilesModule {} 