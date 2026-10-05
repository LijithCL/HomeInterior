import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CustomTemplatesService } from './custom-templates.service';
import { CreateCustomTemplateDto } from './dto/create-custom-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class CustomTemplatesController {
  constructor(private readonly customTemplates: CustomTemplatesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.customTemplates.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCustomTemplateDto) {
    return this.customTemplates.create(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.customTemplates.remove(user.id, id);
  }
}
