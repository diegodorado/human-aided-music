import {reverseMidiMapping} from "./midiMapping"

// state

let recorder = null
let options = null
let ctx = null
const rows = []

const measures = 8
const stepsPerMeasure = 16
const steps = stepsPerMeasure*measures
const recorderRange = 18
const transportRange = 5 // space, seed, cursor, generated, space
const drumsRange = 9
const totalRange = recorderRange + transportRange + drumsRange

const blue =  '#509eec'
const cellWidth = 10
const cellHeight = 15
const canvasWidth = cellWidth * steps
const canvasHeight = cellHeight * totalRange

const musicalSymbols = ['♭','♮','♯']
const randomMusicalSymbol = () => musicalSymbols[Math.floor(Math.random()*musicalSymbols.length)]


const voightKampffTestQuestions = 'You are in a desert         walking along in the sand             when all of the sudden you look down               and you see a tortoise           crawling toward you            You reach down             you flip the tortoise over on its back                 The tortoise lays on its back                its belly baking in the hot sun                beating its legs trying to turn itself over                but it can not           not without your help                  But you are not helping            Why is that ? '.split('').map(c => c===' '? randomMusicalSymbol() : c)
let randomCharIdx = -1
const randomChar = () => {
  randomCharIdx++
  randomCharIdx %= voightKampffTestQuestions.length
  return voightKampffTestQuestions[randomCharIdx]
}


const rainChars = " All those moments            will be lost in time             like tears in rain ".split('').map(c => c===' '? randomMusicalSymbol() : c)
let rainIdx = -1
const rainChar = () => {
  rainIdx++
  rainIdx %= rainChars.length
  return rainChars[rainIdx]
}



export const setupOrca =  (canvas, _recorder, opts) => {
  options = opts
  recorder = _recorder
  const dpr = window.devicePixelRatio || 1
  ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  canvas.width  = canvasWidth* dpr
  canvas.height = canvasHeight* dpr
  ctx.fillStyle = 'white'
  ctx.font = `${cellHeight}px Inconsolata`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Scale all drawing operations by the dpr
  ctx.scale(dpr, dpr)

  //fill cache
  for ( let i = 0; i< steps; i++){
    const items = []
    for ( let j = 0; j< totalRange; j++){
      const p = (j===(recorderRange+2))
      items.push({alpha:p?1:0.3,char:p?'-':'·', empty:!p})
    }
    rows.push(items)
  }

  // draw canvas
  for ( let i = 0; i< steps; i++){
    for ( let j = 0; j< totalRange; j++){
      drawCell(i,j)
    }
  }

}

const drawCell = (i,j, highlight=false) =>{
  ctx.globalAlpha = rows[i][j].alpha
  if(highlight){
    ctx.fillStyle = blue
    ctx.fillRect( cellWidth*i, cellHeight*j,cellWidth,cellHeight)
    ctx.fillStyle = 'white'
  }
  ctx.fillText(rows[i][j].char, cellWidth*(i+0.5), cellHeight*(j+0.5) )
}

export const updateOrcaNote = (note) =>{
  const i = note.quantizedStartStep
  let j = (note.pitch-recorder.minPitch)/(recorder.maxPitch - recorder.minPitch)
  j = recorderRange - Math.round(recorderRange*j)
  if(j<0) j = 0
  if(j>recorderRange) j = recorderRange-1

  rows[i][j].alpha = 0.5+note.velocity/127/2
  rows[i][j].char = randomChar()
  rows[i][j].empty = false

  // redraw cell
  drawCell(i,j, true)
}


export const updateOrcaVis = (tick) =>{
  const prev_tick = (tick-1+steps)%steps
  const prev2_tick = (tick-3+steps)%steps

  ctx.clearRect( cellWidth*tick,0,cellWidth,canvasHeight)
  //ctx.clearRect( cellWidth*prev_tick,0,cellWidth,canvasHeight)

  for ( let i = 0; i< totalRange; i++){
    //reset previous
    //drawCell(prev_tick,i)
    drawCell(tick,i,!rows[tick][i].empty)

    //check if a note should be off
    if(i < recorderRange && !rows[prev2_tick][i].empty){
      if(!rows[prev2_tick][i].empty){
        ctx.clearRect( cellWidth*prev2_tick,cellHeight*i,cellWidth,cellHeight)
        drawCell(prev2_tick,i, false)
      }
    }
    else{
      ctx.clearRect( cellWidth*prev_tick,cellHeight*i,cellWidth,cellHeight)
      drawCell(prev_tick,i, false)
    }

  }

  ctx.strokeStyle = "#333"
  ctx.lineWidth = 1
  for ( let i = 1; i< options.subdivisions; i++){
    ctx.beginPath()
    ctx.moveTo((canvasWidth/options.subdivisions)*i, 0)
    ctx.lineTo((canvasWidth/options.subdivisions)*i, canvasHeight)
    ctx.stroke()
  }
}


export const updateOrcaDrums = (qns, destination, chunks) =>{

  const offsetY = recorderRange + transportRange
  const destSize = (steps/chunks)
  const offsetX = destination*destSize

  // clean up
  for ( let i = offsetX; i< offsetX+destSize; i++){
    for ( let j = 0; j< totalRange; j++){
      if(j <= recorderRange || j >= recorderRange + transportRange){
        rows[i][j].alpha = 0.3
        rows[i][j].char = '·'
        rows[i][j].empty = true
      }
    }
  }

  // set notes
  qns.notes
    .map(n => {
      const idx = drumsRange - 1 - reverseMidiMapping.get(n.pitch)
      const opacity = n.velocity ? (0.5+n.velocity/127/2) : 1
      return {idx,opacity,step: n.quantizedStartStep}
    })
    .sort( (a, b) => {
      // this sort is for text reading
      const al = Math.floor(a.idx/3)
      const bl = Math.floor(b.idx/3)
      if(al < bl)
        return -1
      else if(al > bl)
        return 1
      else if(a.idx !== b.idx)
        return a.idx-b.idx
      else
        return a.step-b.step
    })
    .forEach( n => {
      const item = rows[offsetX+n.step][offsetY+n.idx]
      item.alpha = n.opacity
      item.char = rainChar()
      item.empty = false
    })


  // clear canvas region
  ctx.clearRect( cellWidth*offsetX,0,cellWidth*destSize,canvasHeight)

  // draw notes
  for ( let i = offsetX; i< offsetX+destSize; i++)
    for ( let j = 0; j< totalRange; j++)
        drawCell(i,j)

}


export const updateOrcaMarkers = (chunks, chunk, next_chunk) =>{

  const destSize = (steps/chunks)
  const seed = (i) => i >= (steps/chunks)*chunk && i < (steps/chunks)*(chunk+1)
  const gen = (i) => i >= (steps/chunks)*next_chunk && i < (steps/chunks)*(next_chunk+1)

  for ( let i = 0; i< steps; i++){
    rows[i][recorderRange+1].char = seed(i) ? '↧' : '·'
    rows[i][recorderRange+3].char = gen(i) ? '↯' : '·'
  }

  // clear canvas region
  ctx.clearRect( 0,(recorderRange+1)*cellHeight,canvasWidth,cellHeight)
  ctx.clearRect( 0,(recorderRange+3)*cellHeight,canvasWidth,cellHeight)

  // draw symbols
  for ( let i = 0; i< steps; i++){
    drawCell(i,recorderRange+1)
    drawCell(i,recorderRange+3)
  }

  //todo: move elsewhere
  // updates recorder boundaries
  const pitches = recorder.notes.map ( n => n.pitch)
  const outsiders = pitches.filter(i=> i<recorder.minPitch || i>recorder.maxPitch)
  if(outsiders.length>0 || (recorder.maxPitch-recorder.minPitch)>recorderRange){
    if(pitches.length>0){
      recorder.minPitch = Math.min(...pitches) - 1
      recorder.maxPitch = Math.max(...pitches) + 1
    }
  }

}
