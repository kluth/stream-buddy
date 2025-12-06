import { Test, TestingModule } from '@nestjs/testing';
import { StreamEventsGateway } from './stream-events.gateway';

describe('StreamEventsGateway', () => {
  let gateway: StreamEventsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StreamEventsGateway],
    }).compile();

    gateway = module.get<StreamEventsGateway>(StreamEventsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
