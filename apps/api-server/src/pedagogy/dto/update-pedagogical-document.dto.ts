import { PartialType } from '@nestjs/mapped-types';
import { CreatePedagogicalDocumentDto } from './create-pedagogical-document.dto';

export class UpdatePedagogicalDocumentDto extends PartialType(CreatePedagogicalDocumentDto) {}
