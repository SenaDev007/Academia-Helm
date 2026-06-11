import { PartialType } from '@nestjs/mapped-types';
import { CreatePedagogicalMaterialDto } from './create-pedagogical-material.dto';

export class UpdatePedagogicalMaterialDto extends PartialType(CreatePedagogicalMaterialDto) {}
