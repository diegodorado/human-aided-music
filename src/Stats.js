import Stats from 'stats.js'

let beginTime = ( performance || Date ).now()
let prevTime = ( performance || Date ).now()
let frames = 0
const msPanel =  new Stats.Panel( 'MS', '#509eec', '#111' )
const fpsPanel =  new Stats.Panel( 'FPS', '#509eec', '#111' )
const memPanel =  new Stats.Panel( 'MB', '#509eec', '#111' )

export const setupStats = (el) => {

  el.appendChild(fpsPanel.dom)
  el.appendChild(msPanel.dom)
  el.appendChild(memPanel.dom)

  function animate() {
  	frames ++;
    var time = ( performance || Date ).now();
    if ( time >= prevTime + 1000 ) {
      fpsPanel.update( ( frames * 1000 ) / ( time - prevTime ), 100 );
      prevTime = time;
      frames = 0;
      memPanel.update( performance.memory.usedJSHeapSize / 1048576, performance.memory.jsHeapSizeLimit / 1048576 )
    }
  	requestAnimationFrame( animate )
  }
  requestAnimationFrame( animate )
}

export const  beginMs = () => {
  beginTime = ( performance || Date ).now()
}

export const  endMs = () => {
  var time = ( performance || Date ).now()
  msPanel.update( time - beginTime, 1000 )
}
