const OnionSearchAPI = require('./api');

async function main() {
    console.log('🚀 Starting Onion Search API Server...');
    
    const api = new OnionSearchAPI({
        port: process.env.PORT || 3000,
        database: {
            // Use same database config as crawler
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'onion_search',
            user: process.env.DB_USER || process.env.USER || 'danielbednarski',
            password: process.env.DB_PASSWORD || '',
        }
    });

    try {
        await api.start();
        
        console.log('\n📖 API Usage Examples:');
        console.log('# Search page content:');
        console.log('curl "http://localhost:3000/search/text?q=bitcoin"');
        console.log('\n# Search HTTP headers:');
        console.log('curl "http://localhost:3000/search/headers?header=server&value=nginx"');
        console.log('\n# Combined search:');
        console.log('curl "http://localhost:3000/search/combined?q=privacy&header=server"');
        console.log('\n# Get statistics:');
        console.log('curl "http://localhost:3000/stats"');
        console.log('\n# List domains:');
        console.log('curl "http://localhost:3000/domains"');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down API server...');
            await api.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start API server:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OnionSearchAPI };