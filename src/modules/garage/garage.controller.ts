import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GarageService } from './garage.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { AddMaintenanceRecordDto } from './dto/add-maintenance-record.dto';
import { AddRegistrationEventDto } from './dto/add-registration-event.dto';
import { CreateSaleContractDto } from './dto/create-sale-contract.dto';
import { AddOdometerLogDto } from './dto/add-odometer-log.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateSaleListingDto } from './dto/create-sale-listing.dto';
import { PublishSaleListingDto } from './dto/publish-sale-listing.dto';
import { VehicleProfileTier } from '../../prisma/generated-client';
import { IncomingHttpHeaders } from 'http';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

@ApiTags('garage')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'User identifier. Supports x-user-id, x-userid, user-id, userid header keys.',
})
@Controller('garage')
export class GarageController {
  constructor(private readonly garageService: GarageService) {}

  @Post('vehicles')
  createVehicle(
    @Headers() headers: IncomingHttpHeaders,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.garageService.createVehicle(this.requireUserId(headers), dto);
  }

  @Get('vehicles')
  listMyVehicles(@Headers() headers: IncomingHttpHeaders) {
    return this.garageService.listMyVehicles(this.requireUserId(headers));
  }

  @Get('vehicles/:vehicleId')
  getVehicle(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.getVehicleDetails(this.requireUserId(headers), vehicleId);
  }

  @Patch('vehicles/:vehicleId')
  updateVehicle(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.garageService.updateVehicle(this.requireUserId(headers), vehicleId, dto);
  }

  @Patch('vehicles/:vehicleId/primary')
  setPrimaryVehicle(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.setPrimaryVehicle(this.requireUserId(headers), vehicleId);
  }

  @Post('vehicles/:vehicleId/photos')
  @UseInterceptors(FilesInterceptor('files', 12))
  addVehiclePhotos(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.garageService.addVehiclePhotos(this.requireUserId(headers), vehicleId, files);
  }

  @Delete('vehicles/:vehicleId/photos/:photoId')
  deleteVehiclePhoto(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.garageService.deleteVehiclePhoto(
      this.requireUserId(headers),
      vehicleId,
      photoId,
    );
  }

  @Post('vehicles/:vehicleId/maintenance')
  addMaintenance(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AddMaintenanceRecordDto,
  ) {
    return this.garageService.addMaintenance(this.requireUserId(headers), vehicleId, dto);
  }

  @Post('vehicles/:vehicleId/maintenance/:maintenanceId/attachments')
  @UseInterceptors(FilesInterceptor('files', 10))
  addMaintenanceAttachments(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Param('maintenanceId') maintenanceId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.garageService.addMaintenanceAttachments(
      this.requireUserId(headers),
      vehicleId,
      maintenanceId,
      files,
    );
  }

  @Post('vehicles/:vehicleId/odometer')
  addOdometerLog(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AddOdometerLogDto,
  ) {
    return this.garageService.addOdometerLog(this.requireUserId(headers), vehicleId, dto);
  }

  @Post('vehicles/:vehicleId/registration-events')
  addRegistrationEvent(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AddRegistrationEventDto,
  ) {
    return this.garageService.addRegistrationEvent(this.requireUserId(headers), vehicleId, dto);
  }

  @Post('vehicles/:vehicleId/sale-contracts')
  createSaleContract(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateSaleContractDto,
  ) {
    return this.garageService.createSaleContract(this.requireUserId(headers), vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/sale-platforms')
  getSalePlatforms(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.getSalePlatforms(this.requireUserId(headers), vehicleId);
  }

  @Get('public-listings')
  listPublicListings() {
    return this.garageService.listPublicListings();
  }

  @Get('public-listings/:listingId')
  getPublicListing(@Param('listingId') listingId: string) {
    return this.garageService.getPublicListing(listingId);
  }

  @Get('vehicles/:vehicleId/sale-listings')
  listSaleListings(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.listSaleListings(this.requireUserId(headers), vehicleId);
  }

  @Post('vehicles/:vehicleId/sale-listings')
  upsertSaleListing(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateSaleListingDto,
  ) {
    return this.garageService.upsertSaleListing(this.requireUserId(headers), vehicleId, dto);
  }

  @Post('sale-listings/:saleListingId/publish')
  publishSaleListing(
    @Headers() headers: IncomingHttpHeaders,
    @Param('saleListingId') saleListingId: string,
    @Body() dto: PublishSaleListingDto,
  ) {
    return this.garageService.publishSaleListing(this.requireUserId(headers), saleListingId, dto);
  }

  @Post('sale-listings/:saleListingId/unpublish')
  unpublishSaleListing(
    @Headers() headers: IncomingHttpHeaders,
    @Param('saleListingId') saleListingId: string,
  ) {
    return this.garageService.unpublishSaleListing(this.requireUserId(headers), saleListingId);
  }

  @Get('vehicles/:vehicleId/recommendations')
  getRecommendations(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.getRecommendations(this.requireUserId(headers), vehicleId);
  }

  @Get('vehicles/:vehicleId/insights')
  getInsights(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.garageService.getInsights(this.requireUserId(headers), vehicleId);
  }

  @Get('vehicles/:vehicleId/profile')
  getVehicleProfile(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Query('tier') tier?: string,
  ) {
    const requestedTier =
      tier === 'owner'
        ? VehicleProfileTier.OWNER
        : tier === 'paid'
          ? VehicleProfileTier.PAID
          : VehicleProfileTier.PUBLIC;
    return this.garageService.getVehicleProfile(
      vehicleId,
      requestedTier,
      this.extractUserId(headers),
    );
  }

  @Post('vehicles/:vehicleId/reports/:provider/purchase')
  purchaseReportAccess(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Param('provider') provider: string,
  ) {
    return this.garageService.purchaseReportAccess(
      this.requireUserId(headers),
      vehicleId,
      provider,
    );
  }

  @Post('vehicles/:vehicleId/reports/:provider/request')
  requestReport(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Param('provider') provider: string,
    @Query('tier') tier?: string,
  ) {
    const reportTier =
      tier === 'paid'
        ? VehicleProfileTier.PAID
        : tier === 'owner'
          ? VehicleProfileTier.OWNER
          : VehicleProfileTier.PUBLIC;
    return this.garageService.requestReport(
      this.requireUserId(headers),
      vehicleId,
      provider,
      reportTier,
    );
  }

  @Get('vehicles/:vehicleId/reports/:provider/latest')
  getLatestReport(
    @Headers() headers: IncomingHttpHeaders,
    @Param('vehicleId') vehicleId: string,
    @Param('provider') provider: string,
  ) {
    return this.garageService.getLatestReport(
      vehicleId,
      provider,
      this.extractUserId(headers),
    );
  }

  private requireUserId(headers: IncomingHttpHeaders): string {
    const userId = this.extractUserId(headers);
    if (!userId) {
      throw new BadRequestException('Missing x-user-id header.');
    }
    return userId;
  }

  private extractUserId(headers: IncomingHttpHeaders): string | undefined {
    const value =
      headers['x-user-id'] ??
      headers['x-userid'] ??
      headers['user-id'] ??
      headers['userid'];

    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return undefined;
  }
}
