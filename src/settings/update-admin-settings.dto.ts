import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, Matches, ValidateIf, ValidateNested } from 'class-validator';

const ASSET_VALUE_PATTERN =
  /^(data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s]+|[A-Za-z0-9_./\\-]+)$/i;

export class DocumentAssetsDto {
  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.principalSignature)
  @Matches(ASSET_VALUE_PATTERN)
  principalSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.hrSignature)
  @Matches(ASSET_VALUE_PATTERN)
  hrSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.chairmanSignature)
  @Matches(ASSET_VALUE_PATTERN)
  chairmanSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.accountantSignature)
  @Matches(ASSET_VALUE_PATTERN)
  accountantSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.managerSignature)
  @Matches(ASSET_VALUE_PATTERN)
  managerSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000000)
  @ValidateIf((o) => !!o.rubberStamp)
  @Matches(ASSET_VALUE_PATTERN)
  rubberStamp?: string;
}

export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  schoolCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  academicYear?: string;

  @IsOptional()
  @IsBoolean()
  requireApprovalForAdmission?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAdmissionEditAfterApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  enableFeesModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTransportModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableStaffModule?: boolean;

  @IsOptional()
  @IsBoolean()
  admissionNoAutoGenerate?: boolean;

  @IsOptional()
  @IsBoolean()
  enableIndividualDemotion?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentAssetsDto)
  documentAssets?: DocumentAssetsDto;
}
