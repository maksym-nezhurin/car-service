import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const CATALOG_REVIEW_STATUSES = ['approved', 'draft', 'rejected'] as const;
export type CatalogReviewStatus = (typeof CATALOG_REVIEW_STATUSES)[number];

/** Admin-only edit surface for a generation: flag it, or fix its display data. */
export class UpdateGenerationAdminDto {
  @IsOptional()
  @IsIn(CATALOG_REVIEW_STATUSES)
  reviewStatus?: CatalogReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string;
}
