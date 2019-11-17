import {reverseMidiMapping} from "./midiMapping"

// state
let tick = 0
const rows = []


const measures = 8
const stepsPerMeasure = 16
const steps = stepsPerMeasure*measures
//fixme: be aware of these two, length is critical
const orcaSeed      = '↧↧↧↧↧↧↧↧↧↧↧↧↧ SEED ↧↧↧↧↧↧↧↧↧↧↧↧'.split('')
const orcaGenerated = '↯↯↯↯↯↯↯↯↯↯ GENERATED ↯↯↯↯↯↯↯↯↯↯'.split('')
const recorderRange = 12
const transportRange = 5 // space, seed, cursor, generated, space
const drumsRange = 9
const totalRange = recorderRange + transportRange + drumsRange


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

const setupOrca =  (orcaVis) => {
  //create DOMs
  for ( let i = 0; i< totalRange; i++){
    const items = []
    const p = document.createElement('p')
    for ( let j = 0; j< steps; j++){
      const item = document.createElement('i')
      if(i===(recorderRange+2)){
        item.textContent =  '-'
      }else{
        item.textContent =  '.'
        item.style= `opacity:0.35`
      }
      p.appendChild(item)
      items.push(item)
    }
    orcaVis.appendChild(p)
    rows.push(items)
  }
}


const updateOrcaVis = (recorder) =>{
  // update tick

  for ( let i = 0; i< totalRange; i++){
    // backward clean up
    rows[i][(tick-1+steps)%steps].classList.remove('current-tick')
    rows[i][tick].classList.add('current-tick')
  }

  recorder.notes
    .filter(n => (tick - n.quantizedStartStep+steps)%steps <=1  )
    .forEach( n => {
      let i = (n.pitch-recorder.minPitch)/(recorder.maxPitch - recorder.minPitch)
      if(i<0) i = 0
      if(i>1) i = 1
      const idx = recorderRange-Math.round(i*recorderRange)
      const step = n.quantizedStartStep%steps
      const item = rows[idx][step]
      const opacity = 0.5+n.velocity/127/2
      if(item.textContent==='.'){
        item.textContent = randomChar()
        item.style= `opacity:${opacity}`
      }
    })

  tick++
  tick %= steps
}


const updateOrcaDrums = (qns, destination, chunks) =>{
  const offsetY = recorderRange + transportRange
  const destSize = (steps/chunks)
  const offsetX = destination*destSize

  // clean up
  for ( let i = 0; i< totalRange; i++){
    if(i <= recorderRange || i >= recorderRange + transportRange){
      for ( let j = offsetX; j< offsetX+destSize; j++){
        rows[i][j].style='opacity:0.35'
        rows[i][j].textContent='.'
      }
    }
  }

  qns.notes
    .map(n => {
      const idx = drumsRange - 1 - reverseMidiMapping.get(n.pitch)
      const opacity = n.velocity ? (0.5+n.velocity/127/2) : 1
      return {idx,opacity,step: n.quantizedStartStep}
    })
    .sort( (a, b) => {
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
      const item = rows[offsetY+n.idx][offsetX+n.step]
      item.textContent = rainChar()
      item.style=`opacity:${n.opacity};`
    })


}

const updateOrcaMarkers = (recorder,chunks, chunk, next_chunk) =>{
  for ( let j = 0; j< steps; j++){
    const ch = Math.floor(j/(steps)*chunks)
    const seed = ch===chunk
    const gen = ch===next_chunk
    const i = j-chunk*(steps/chunks)
    rows[recorderRange+1][j].textContent = seed ? orcaSeed[i] : '.'
    const _i = j-next_chunk*(steps/chunks)
    rows[recorderRange+3][j].textContent = gen ? orcaGenerated[_i] : '.'
  }

  //updates recorder boundaries
  const pitches = recorder.notes.map ( n => n.pitch)
  const outsiders = pitches.filter(i=> i<recorder.minPitch || i>recorder.maxPitch)
  if(outsiders.length>0 || (recorder.maxPitch-recorder.minPitch)>recorderRange){
    if(pitches.length>0){
      recorder.minPitch = Math.min(...pitches) - 1
      recorder.maxPitch = Math.max(...pitches) + 1
    }
  }

}

export { setupOrca,updateOrcaVis, updateOrcaDrums,updateOrcaMarkers}
