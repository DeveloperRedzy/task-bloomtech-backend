import app from './app';
import { config } from './config/app.config';
import { initializeDatabase } from './config/database.config';

async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    console.log('🚀 Starting BloomTech Work Tracker API...');
    console.log(`📍 Environment: ${config.app.nodeEnv}`);

    // Initialize database connection
    await initializeDatabase();

    // Start the Express server
    const server = app.listen(config.app.port, () => {
      console.log(`🌐 Server is running on port ${config.app.port}`);
      console.log(`🔗 API available at: http://localhost:${config.app.port}`);
      console.log(`🏥 Health check: http://localhost:${config.app.port}/health`);
      console.log(`📊 Environment: ${config.app.nodeEnv}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string): void => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(() => {
        console.log('📡 HTTP server closed');
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      console.log('🛑 Shutting down due to uncaught exception');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      console.log('🛑 Shutting down due to unhandled promise rejection');
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
