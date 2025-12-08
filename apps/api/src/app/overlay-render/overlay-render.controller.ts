import { Controller, Get, Param, Res, Logger, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express'; // Import Response from express
import { OverlayRenderService } from './overlay-render.service';
import { SaveOverlayDto } from './dto/save-overlay.dto';
// import { OverlayElement } from './interfaces'; // Removed, now imported via service


@Controller('overlays') // Base path for overlay operations
export class OverlayRenderController {
  private readonly logger = new Logger(OverlayRenderController.name);

  constructor(private readonly overlayRenderService: OverlayRenderService) {}

  @Get('render/:internalUserId/:overlayName') // Endpoint to render the overlay
  async renderOverlay(
    @Param('internalUserId') internalUserId: string,
    @Param('overlayName') overlayName: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Rendering overlay "${overlayName}" for internal user ID: ${internalUserId}`);
    const htmlContent = await this.overlayRenderService.generateOverlayHtml(internalUserId, overlayName);
    res.header('Content-Type', 'text/html');
    res.send(htmlContent);
  }

  @Get('config/:internalUserId/:overlayName') // Endpoint to get overlay configuration as JSON
  async getOverlayConfig(
    @Param('internalUserId') internalUserId: string,
    @Param('overlayName') overlayName: string,
  ) {
    this.logger.log(`Retrieving overlay configuration "${overlayName}" for internal user ID: ${internalUserId}`);
    const config = await this.overlayRenderService.getOverlayConfig(internalUserId, overlayName);
    if (!config) {
      // Return a 404 or an empty array if no config is found
      return [];
    }
    return config;
  }

  @Post('save/:internalUserId') // Endpoint to save an overlay configuration
  @HttpCode(HttpStatus.OK)
  async saveOverlayConfig(
    @Param('internalUserId') internalUserId: string,
    @Body() saveOverlayDto: SaveOverlayDto,
  ) {
    this.logger.log(`Saving overlay configuration "${saveOverlayDto.overlayName}" for internal user ID: ${internalUserId}`);
    await this.overlayRenderService.saveOverlayConfig(internalUserId, saveOverlayDto.overlayName, saveOverlayDto.overlayConfig);
    return { message: 'Overlay configuration saved successfully.' };
  }
}
