const { LoadBalancer } = require('../../')

// Lets define what servers we want to load balance for
const serversToLoadBalance = [{
  host: 'localhost',
  port: 1251
}]
// In a real-world scenario you would of course have multiple servers in here

// Start a load balancer server on port 1250
// This server acts just like a normal ezrpc Server, but will relay any undefined methods to
// servers in serversToLoadBalance
const server = new LoadBalancer(serversToLoadBalance, 1250)

// Your load balancer is already set up now!
// The function call to myMethod in client.js will be relayed
// to the server that was defined in server.js (running on localhost:1251) 

// Exporting modules (as shown below) is completely optional
// If you do export methods, however, they will not be relayed
// to a server in serversToLoadBalance but will be executed by
// the load balancer itself
//
// server.module.exports = {
//   ...
// }
