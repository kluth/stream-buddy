// Mock Twurple
export class ApiClient {
  users = {
    getUserByName: jest.fn(),
    getMe: jest.fn(),
  };
  moderation = {
    banUser: jest.fn(),
    deleteChatMessages: jest.fn(),
  };
  streams = {
    getStreamByUserId: jest.fn(),
  };
  games = {
    getGameByName: jest.fn(),
  };
  channels = {
    getChannelFollowerCount: jest.fn(),
    updateChannelInfo: jest.fn(),
  };
  subscriptions = {
    getSubscriptions: jest.fn(),
  };
}

export class StaticAuthProvider {}
export class ChatClient {
  connect = jest.fn();
  quit = jest.fn();
  say = jest.fn();
  onMessage = jest.fn();
  onSub = jest.fn();
  onResub = jest.fn();
  onGiftPaidUpgrade = jest.fn();
  onCommunitySub = jest.fn();
  onRaid = jest.fn();
}
