const OSC = require('osc-js')
const oscConfig = {
  udpServer: {
    host: '0.0.0.0',
    port: 40001,
    exclusive: false
  },
  wsServer: {
    host: 'localhost',
    port: 40000,
    secure: true
  }
}
const osc = new OSC({ plugin: new OSC.BridgePlugin(oscConfig) })
osc.open()
