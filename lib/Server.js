const net = require('net')

const Call = require('./Call')
const Callback = require('./Callback')

/**
 * RPC server that allows clients to execute exposed methods
 * @property {Number} port - port to listen on
 * @property {Proxy} methods - proxy used to get/set methods
 * @property {Proxy} module - used to emulate module.exports
 * @property {Object} module.exports - emulates addMethods when this is set to an object
 * @property {net.Server} server - tcp server
 */
class Server {
  /**
   * Constructs a Server instance
   * @param {Number} port - port to allow connections on
   */
  constructor (port) {
    if (!port || typeof port !== 'number') throw new Error('Provide a valid port!')
    this.port = port
    this.methods = new Proxy({}, {
      set: (target, property, value) => {
        if (typeof value !== 'function') throw new Error('Provide a function!')
        // Make method a promise (easier to handle)
        target[property] = async (...args) => value(...args)
        return true
      },
      // Un-exposes/removes a method
      deleteProperty: (target, property) => {
        delete target[property]
        return true
      }
    })
    this.module = new Proxy({ exports: this.methods }, {
      set: (target, property, value) => {
        if (property !== 'exports') throw new Error('Only module.exports can be set')
        if (typeof value !== 'object') throw new Error('Provide an object!')
        this.addMethods(value)
        return true
      }
    })
    this.server = new net.Server()

    this.setUp()
    this.listen()
  }

  /**
   * Sets up listeners
   */
  setUp () {
    // Listen to incoming function calls
    this.server.on('connection', socket => {
      socket.on('error', () => {
        // At this point this socket will have been destroyed
        // So there is nothing we need to do here
      })

      socket.on('data', async data => {
        try {
          const { methodName, messageId, args } = Call.fromBuffer(data)
          const method = this.methods[methodName]
          if (!method) {
            socket.write(new Callback(messageId, null, 'No such method!').getBuffer())
            return
          }
          method(...args)
            .then(response => socket.write(new Callback(messageId, response, null).getBuffer()))
            .catch(error => socket.write(new Callback(messageId, null, error.message).getBuffer()))
        } catch (error) {
          // The message sent was not a call
          // This should never happen (the client currently only sends calls)
        }
      })
    })
  }

  /**
   * Starts listening
   * @returns {Promise} promise that resolves when the server starts listening
   */
  listen () {
    return new Promise(resolve => this.server.listen(this.port, resolve))
  }

  /* eslint-disable */
  /**
   * Exposes methods to the client
   * @param {Object<string, Function>} methodObj - object of methods
   *//**
   * Exposes methods to the client
   * @param  {...Function} methods - named methods
   */
  addMethods (methodObj, ...methods) {
    /* eslint-enable */
    if (typeof methodObj === 'function') {
      // Add methods by name (& make sure only methods were provided)
      methods = [methodObj].concat(methods)
      if (methods.some(method => typeof method !== 'function' || !method.name)) throw new Error('Provide only named functions!')
      methods.forEach(method => {
        const { name } = method
        this.methods[name] = method
      })
    } else if (typeof methodObj === 'object') {
      if (Object.values(methodObj).some(method => typeof method !== 'function')) throw new Error('Provide only functions!')
      Object.entries(methodObj).forEach(([key, value]) => {
        this.methods[key] = value
      })
    } else throw new Error('Provide an object mapping strings to functions!')
  }

  /**
   * Un-exposes methods
   * @param  {...Function|String} methods - named methods
   */
  removeMethods (...methods) {
    if (!methods.length) throw new Error('Provide an array of named functions/function names!')
    methods.forEach(method => {
      const { name = method } = method
      delete this.methods[name]
    })
  }
}

module.exports = Server
