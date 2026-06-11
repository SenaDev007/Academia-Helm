import { PartialType } from '@nestjs/mapped-types';
import { CreateFeeConfigurationDto } from './create-fee-configuration.dto';

export class UpdateFeeConfigurationDto extends PartialType(CreateFeeConfigurationDto) {}

