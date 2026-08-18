import { IsString, IsOptional, IsIn, Length, MaxLength } from 'class-validator'

export class CreateDocumentDto {
  @IsString()
  @Length(1, 255)
  title!: string

  @IsString()
  @IsOptional()
  @MaxLength(50_000)
  content?: string

  @IsString()
  @IsOptional()
  @Length(1, 64)
  category?: string

  @IsString()
  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: string
}

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  @Length(1, 255)
  title?: string

  @IsString()
  @IsOptional()
  @MaxLength(50_000)
  content?: string

  @IsString()
  @IsOptional()
  @Length(1, 64)
  category?: string

  @IsString()
  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: string
}
