const Server = require('../Server')
const Call = require('../Call')

jest.mock('net')

const server = new Server(1250)

const asyncConstructor = (async () => {}).constructor

describe('constructor works', () => {
  it('when providing invalid arguments', () => {
    expect(() => new Server()).toThrow(new Error('Provide a valid port!'))
    expect(() => new Server('123')).toThrow(new Error('Provide a valid port!'))
  })

  it('when providing valid arguments', () => {
    expect(server.port).toBe(1250)
  })

  it('setUp is called', () => {
    expect(server.server.on).toHaveBeenLastCalledWith('connection', expect.any(Function))
  })

  it('listen is called', () => {
    expect(server.server.listen).toHaveBeenCalled()
  })
})

describe('setUp works', () => {
  const socket = {
    on: jest.fn(),
    write: jest.fn()
  }

  it('connection listener works', () => {
    const connListener = server.server.on.mock.calls[0][1]
    connListener(socket)
    expect(socket.on).toHaveBeenLastCalledWith('data', expect.any(Function))
  })

  it('error listener works', () => {
    const errorListener = socket.on.mock.calls[0][1]
    expect(errorListener).not.toThrow()
  })

  describe('data listener works', () => {
    let dataListener
    beforeAll(() => {
      dataListener = jest.fn(socket.on.mock.calls[1][1])
    })

    it('when providing an invalid message', () => {
      const data = Buffer.alloc(4)
      dataListener(data)
      expect(dataListener).toHaveBeenLastCalledWith(data)
    })

    it('when providing a call with an unknown method', () => {
      const data = new Call(0, 'methodX', []).getBuffer()
      dataListener(data)
      expect(dataListener).toHaveBeenLastCalledWith(data)
    })

    it('when providing a resolving method', () => {
      const a = jest.fn(() => 'b')
      server.methods.a = a
      const data = new Call(0, 'a', [1, 2]).getBuffer()
      dataListener(data)
      expect(dataListener).toHaveBeenLastCalledWith(data)
      expect(a).toHaveBeenLastCalledWith(1, 2)
      expect(a).toHaveLastReturnedWith('b')
    })

    it('when providing a rejecting method', () => {
      const c = jest.fn(() => { throw new Error('d') })
      server.methods.c = c
      const data = new Call(0, 'c', [3, 4]).getBuffer()
      dataListener(data)
      expect(dataListener).toHaveBeenLastCalledWith(data)
      expect(socket.write).toHaveBeenLastCalledWith(expect.any(Buffer))
      expect(c).toHaveBeenLastCalledWith(3, 4)
      expect(c.mock.results[0].type).toBe('throw')
      expect(c.mock.results[0].value).toEqual(new Error('d'))
    })
  })
})

describe('methods proxy works', () => {
  describe('when setting methods', () => {
    it('when providing invalid arguments', () => {
      expect(() => { server.methods.myMethod = 123 }).toThrow(new Error('Provide a function!'))
    })

    const fn = jest.fn()
    it('property is set', () => {
      server.methods.myMethod = fn
      expect(server.methods.myMethod).toBeDefined()
    })

    it('function is converted to an async function', () => {
      expect(server.methods.myMethod).not.toEqual(fn)
      expect(server.methods.myMethod).toEqual(expect.any(asyncConstructor))
    })

    it('async function calls original function', () => {
      server.methods.myMethod('a', 'b')
      expect(fn).toHaveBeenLastCalledWith('a', 'b')
    })
  })

  it('when removing methods', () => {
    delete server.methods.myMethod
    expect(server.methods.myMethod).toBeUndefined()
  })
})

describe('addMethods works', () => {
  it('when providing invalid input', () => {
    expect(() => server.addMethods('hello')).toThrow(new Error('Provide an object mapping strings to functions!'))
    expect(() => server.addMethods(function () {})).toThrow(new Error('Provide only named functions!'))
  })

  it('when providing an object', () => {
    const obj = {
      methodName: () => {}
    }
    server.addMethods(obj)
    expect(server.methods.methodName).toBeDefined()
  })

  it('when providing a list of functions', () => {
    function fn1 () {}
    function fn2 () {}
    server.addMethods(fn1, fn2)
    expect(server.methods.fn1).toBeDefined()
    expect(server.methods.fn2).toBeDefined()
  })
})

describe('removeMethods works', () => {
  it('when providing no methods', () => {
    expect(() => server.removeMethods()).toThrow(new Error('Provide an array of named functions/function names!'))
  })

  it('when providing named functions', () => {
    server.removeMethods(function fn1 () {}, function methodName () {})
    expect(server.methods.fn1).toBeUndefined()
    expect(server.methods.methodName).toBeUndefined()
  })

  it('when providing unnamed functions', () => {
    expect(() => server.removeMethods(function fn1 () {}, function () {})).toThrow(new Error('Functions must be named!'))
  })

  it('when providing function names', () => {
    server.removeMethods('fn2')
    expect(server.methods.fn2).toBeUndefined()
  })
})

describe('module proxy works', () => {
  it('when providing invalid input', () => {
    expect(() => { server.module.hello = 'goodbye' }).toThrow(new Error('Only module.exports can be set'))
    expect(() => { server.module.exports = 'not an object' }).toThrow(new Error('Provide an object!'))
    expect(() => { server.module.exports = { func: 'not a function' } }).toThrow(new Error('Provide only functions!'))
  })

  describe('when providing valid input', () => {
    it('sets methods properly', async () => {
      const hello = jest.fn(() => 'goodbye')
      server.module.exports = { hello }
      await server.methods.hello()
      expect(hello).toHaveBeenCalled()
    })

    it('removes all methods when re-defining module.exports', () => {
      server.module.exports = { goodbye () { return 'hello' } }
      expect(server.methods.hello).toBeUndefined()
    })
  })
})
