import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { SimulcastService } from './simulcast.service';
import { StartSimulcastDto } from './dto/start-simulcast.dto';
import { StopSimulcastDto } from './dto/stop-simulcast.dto';
import { StreamMetadataDto } from './dto/stream-metadata.dto';
import { SimulateEventDto } from './dto/simulate-event.dto'; // Import new DTO
import { StreamEventsGateway } from '../stream-events/stream-events.gateway'; // Import StreamEventsGateway

@Controller('simulcast')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class SimulcastController {
  constructor(
    private readonly simulcastService: SimulcastService,
    private readonly streamEventsGateway: StreamEventsGateway, // Inject StreamEventsGateway
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  async startSimulcast(@Body() startSimulcastDto: StartSimulcastDto) {
    const { internalUserId, destinations } = startSimulcastDto;
    const success = await this.simulcastService.startSimulcast(internalUserId, destinations);
    if (!success) {
      throw new Error('Failed to start simulcast');
    }
    return { message: 'Simulcast started successfully.' };
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  async stopSimulcast(@Body() stopSimulcastDto: StopSimulcastDto) {
    const { streamPath } = stopSimulcastDto;
    const success = await this.simulcastService.stopSimulcast(streamPath);
    if (!success) {
      throw new Error('Failed to stop simulcast.');
    }
    return { message: 'Simulcast stopped successfully.' };
  }

  @Post('update-metadata')
  @HttpCode(HttpStatus.OK)
  async updateStreamMetadata(@Body() streamMetadataDto: StreamMetadataDto) {
    const success = await this.simulcastService.updateStreamMetadata(streamMetadataDto);
    if (!success) {
      throw new Error('Failed to update stream metadata.');
    }
    return { message: 'Stream metadata updated successfully.' };
  }

  @Post('simulate-event')
  @HttpCode(HttpStatus.OK)
  async simulateEvent(@Body() simulateEventDto: SimulateEventDto) {
    const { eventType, internalUserId, payload } = simulateEventDto;
    // For now, emit to all connected clients. In a real app, you'd filter by internalUserId
    this.streamEventsGateway.emitEvent(eventType, payload);
    return { message: `Event '${eventType}' simulated successfully for user ${internalUserId}.` };
  }
}
