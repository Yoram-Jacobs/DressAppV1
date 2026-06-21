const { MongoClient } = require('mongodb');

async function main() {
    const url = 'mongodb://127.0.0.1:27017';
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db('dressapp');
        const collection = db.collection('suitcases');
        
        const result = await collection.deleteMany({ status: { $ne: "completed" } });
        console.log(`Deleted ${result.deletedCount} active suitcases.`);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
