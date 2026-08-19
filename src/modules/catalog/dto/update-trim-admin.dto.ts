import { IsIn, IsOptional } from 'class-validator';
import { CATALOG_REVIEW_STATUSES, CatalogReviewStatus } from './update-generation-admin.dto';

/** Admin-only edit surface for a trim — currently just the review flag. */
export class UpdateTrimAdminDto {
  @IsOptional()
  @IsIn(CATALOG_REVIEW_STATUSES)
  reviewStatus?: CatalogReviewStatus;
}
