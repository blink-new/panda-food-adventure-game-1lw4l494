import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface Position {
  x: number
  y: number
}

interface FoodItem {
  id: string
  type: 'good' | 'bad'
  emoji: string
  position: Position
  points: number
}

interface Wall {
  id: string
  position: Position
  width: number
  height: number
}

interface GameState {
  panda: Position
  foods: FoodItem[]
  walls: Wall[]
  score: number
  health: number
  level: number
  gameStatus: 'menu' | 'playing' | 'gameOver' | 'levelComplete' | 'timeUp'
  keysPressed: Set<string>
  timeLeft: number
}

const GAME_WIDTH = 800
const GAME_HEIGHT = 600
const PANDA_SIZE = 40
const FOOD_SIZE = 30
const PANDA_SPEED = 5
const LEVEL_TIME = 60 // 60 seconds per level

const GOOD_FOODS = [
  { emoji: '🎋', points: 10 }, // bamboo
  { emoji: '🍎', points: 15 }, // apple
  { emoji: '🍇', points: 12 }, // grapes
  { emoji: '🥕', points: 8 },  // carrot
  { emoji: '🥬', points: 6 },  // lettuce
]

const BAD_FOODS = [
  { emoji: '🍔', points: -20 }, // burger
  { emoji: '🍕', points: -15 }, // pizza
  { emoji: '🍭', points: -10 }, // candy
  { emoji: '🍟', points: -12 }, // fries
  { emoji: '🍩', points: -18 }, // donut
]

const PandaGame: React.FC = () => {
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()
  const timerRef = useRef<number>()
  
  const [gameState, setGameState] = useState<GameState>({
    panda: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
    foods: [],
    walls: [],
    score: 0,
    health: 100,
    level: 1,
    gameStatus: 'menu',
    keysPressed: new Set(),
    timeLeft: LEVEL_TIME
  })

  const checkCollision = useCallback((pos1: Position, pos2: Position, size1: number, size2: number): boolean => {
    return (
      pos1.x < pos2.x + size2 &&
      pos1.x + size1 > pos2.x &&
      pos1.y < pos2.y + size2 &&
      pos1.y + size1 > pos2.y
    )
  }, [])

  const generateWalls = useCallback((level: number): Wall[] => {
    const wallCount = Math.min(2 + Math.floor(level / 2), 8) // Increase walls with level
    const walls: Wall[] = []
    
    for (let i = 0; i < wallCount; i++) {
      const isHorizontal = Math.random() > 0.5
      const width = isHorizontal ? 100 + Math.random() * 150 : 20
      const height = isHorizontal ? 20 : 100 + Math.random() * 150
      
      let position: Position
      let attempts = 0
      
      // Try to place walls away from center and other walls
      do {
        position = {
          x: Math.random() * (GAME_WIDTH - width),
          y: Math.random() * (GAME_HEIGHT - height)
        }
        attempts++
      } while (attempts < 50 && (
        // Avoid center area where panda starts
        (position.x < GAME_WIDTH / 2 + 100 && position.x + width > GAME_WIDTH / 2 - 100 &&
         position.y < GAME_HEIGHT / 2 + 100 && position.y + height > GAME_HEIGHT / 2 - 100) ||
        // Avoid overlapping with existing walls
        walls.some(wall => 
          checkCollision(position, wall.position, Math.max(width, height), Math.max(wall.width, wall.height))
        )
      ))
      
      walls.push({
        id: `wall-${i}`,
        position,
        width,
        height
      })
    }
    
    return walls
  }, [checkCollision])

  const generateFood = useCallback((level: number, walls: Wall[]): FoodItem => {
    const isGood = Math.random() > 0.3 // 70% good food, 30% bad food
    const foodArray = isGood ? GOOD_FOODS : BAD_FOODS
    const food = foodArray[Math.floor(Math.random() * foodArray.length)]
    
    let position: Position
    let attempts = 0
    
    // Try to place food away from walls
    do {
      position = {
        x: Math.random() * (GAME_WIDTH - FOOD_SIZE),
        y: Math.random() * (GAME_HEIGHT - FOOD_SIZE)
      }
      attempts++
    } while (attempts < 50 && walls.some(wall => 
      checkCollision(position, wall.position, FOOD_SIZE, Math.max(wall.width, wall.height))
    ))
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type: isGood ? 'good' : 'bad',
      emoji: food.emoji,
      position,
      points: food.points
    }
  }, [checkCollision])

  const initializeLevel = useCallback((level: number) => {
    const walls = generateWalls(level)
    const foodCount = Math.min(5 + level * 2, 15) // Increase food count with level
    const foods = Array.from({ length: foodCount }, () => generateFood(level, walls))
    
    setGameState(prev => ({
      ...prev,
      foods,
      walls,
      panda: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
      gameStatus: 'playing',
      timeLeft: LEVEL_TIME
    }))
  }, [generateFood, generateWalls])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      setGameState(prev => ({
        ...prev,
        keysPressed: new Set([...prev.keysPressed, event.key])
      }))
    }
  }, [])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setGameState(prev => {
      const newKeysPressed = new Set(prev.keysPressed)
      newKeysPressed.delete(event.key)
      return {
        ...prev,
        keysPressed: newKeysPressed
      }
    })
  }, [])

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (prev.gameStatus !== 'playing') return prev

      let newPanda = { ...prev.panda }
      
      // Handle movement with wall collision detection
      if (prev.keysPressed.has('ArrowUp')) {
        const testY = Math.max(0, newPanda.y - PANDA_SPEED)
        const testPanda = { ...newPanda, y: testY }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, Math.max(wall.width, wall.height)))) {
          newPanda = { ...newPanda, y: testY }
        }
      }
      if (prev.keysPressed.has('ArrowDown')) {
        const testY = Math.min(GAME_HEIGHT - PANDA_SIZE, newPanda.y + PANDA_SPEED)
        const testPanda = { ...newPanda, y: testY }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, Math.max(wall.width, wall.height)))) {
          newPanda = { ...newPanda, y: testY }
        }
      }
      if (prev.keysPressed.has('ArrowLeft')) {
        const testX = Math.max(0, newPanda.x - PANDA_SPEED)
        const testPanda = { ...newPanda, x: testX }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, Math.max(wall.width, wall.height)))) {
          newPanda = { ...newPanda, x: testX }
        }
      }
      if (prev.keysPressed.has('ArrowRight')) {
        const testX = Math.min(GAME_WIDTH - PANDA_SIZE, newPanda.x + PANDA_SPEED)
        const testPanda = { ...newPanda, x: testX }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, Math.max(wall.width, wall.height)))) {
          newPanda = { ...newPanda, x: testX }
        }
      }

      // Check food collisions
      let newScore = prev.score
      let newHealth = prev.health
      const newFoods = prev.foods.filter(food => {
        if (checkCollision(newPanda, food.position, PANDA_SIZE, FOOD_SIZE)) {
          newScore += food.points
          if (food.type === 'good') {
            newHealth = Math.min(100, newHealth + 5)
          } else {
            newHealth = Math.max(0, newHealth - 10)
          }
          return false // Remove eaten food
        }
        return true
      })

      // Check win condition (all good food eaten)
      const hasGoodFood = newFoods.some(food => food.type === 'good')
      let newGameStatus = prev.gameStatus

      if (!hasGoodFood && newFoods.length > 0) {
        // Level complete - only bad food left
        newGameStatus = 'levelComplete'
      } else if (newHealth <= 0) {
        // Game over
        newGameStatus = 'gameOver'
      } else if (prev.timeLeft <= 0) {
        // Time up
        newGameStatus = 'timeUp'
      }

      return {
        ...prev,
        panda: newPanda,
        foods: newFoods,
        score: newScore,
        health: newHealth,
        gameStatus: newGameStatus
      }
    })
  }, [checkCollision])

  // Timer countdown
  useEffect(() => {
    if (gameState.gameStatus === 'playing') {
      timerRef.current = window.setInterval(() => {
        setGameState(prev => ({
          ...prev,
          timeLeft: Math.max(0, prev.timeLeft - 1)
        }))
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gameState.gameStatus])

  // Game loop
  useEffect(() => {
    if (gameState.gameStatus === 'playing') {
      const gameLoop = () => {
        updateGame()
        animationFrameRef.current = requestAnimationFrame(gameLoop)
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gameState.gameStatus, updateGame])

  // Keyboard event listeners
  useEffect(() => {
    const gameArea = gameAreaRef.current
    if (!gameArea) return

    // Focus the game area when playing
    if (gameState.gameStatus === 'playing') {
      gameArea.focus()
    }

    // Add event listeners to both window and game area for better reliability
    const handleKeyDownWrapper = (event: KeyboardEvent) => {
      if (gameState.gameStatus === 'playing') {
        handleKeyDown(event)
      }
    }

    const handleKeyUpWrapper = (event: KeyboardEvent) => {
      if (gameState.gameStatus === 'playing') {
        handleKeyUp(event)
      }
    }

    window.addEventListener('keydown', handleKeyDownWrapper)
    window.addEventListener('keyup', handleKeyUpWrapper)
    gameArea.addEventListener('keydown', handleKeyDownWrapper)
    gameArea.addEventListener('keyup', handleKeyUpWrapper)

    return () => {
      window.removeEventListener('keydown', handleKeyDownWrapper)
      window.removeEventListener('keyup', handleKeyUpWrapper)
      gameArea.removeEventListener('keydown', handleKeyDownWrapper)
      gameArea.removeEventListener('keyup', handleKeyUpWrapper)
    }
  }, [handleKeyDown, handleKeyUp, gameState.gameStatus])

  const startGame = () => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      health: 100,
      level: 1,
      gameStatus: 'playing'
    }))
    initializeLevel(1)
  }

  const nextLevel = () => {
    const newLevel = gameState.level + 1
    setGameState(prev => ({
      ...prev,
      level: newLevel
    }))
    initializeLevel(newLevel)
  }

  const restartGame = () => {
    startGame()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (gameState.gameStatus === 'menu') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-100 to-green-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">🐼</div>
          <h1 className="text-3xl font-bold text-green-800 mb-4">Panda Food Adventure</h1>
          <p className="text-green-600 mb-6">
            Help the panda eat healthy foods while avoiding junk food and navigating around walls!
          </p>
          <div className="text-sm text-green-500 mb-6">
            <p>🎋 🍎 🍇 = Good (+points, +health)</p>
            <p>🍔 🍕 🍭 = Bad (-points, -health)</p>
            <p>🧱 = Walls (avoid them!)</p>
            <p>⏰ = Beat the timer!</p>
            <p className="mt-2">Use arrow keys to move</p>
          </div>
          <Button onClick={startGame} className="bg-green-600 hover:bg-green-700">
            Start Game
          </Button>
        </Card>
      </div>
    )
  }

  if (gameState.gameStatus === 'gameOver') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-100 to-red-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">😵</div>
          <h2 className="text-3xl font-bold text-red-800 mb-4">Game Over!</h2>
          <p className="text-red-600 mb-4">The panda ate too much junk food!</p>
          <p className="text-lg font-semibold mb-6">Final Score: {gameState.score}</p>
          <div className="space-x-4">
            <Button onClick={restartGame} className="bg-green-600 hover:bg-green-700">
              Play Again
            </Button>
            <Button 
              onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'menu' }))}
              variant="outline"
            >
              Main Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameState.gameStatus === 'timeUp') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-orange-100 to-orange-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-3xl font-bold text-orange-800 mb-4">Time's Up!</h2>
          <p className="text-orange-600 mb-4">The panda ran out of time!</p>
          <p className="text-lg font-semibold mb-6">Final Score: {gameState.score}</p>
          <div className="space-x-4">
            <Button onClick={restartGame} className="bg-green-600 hover:bg-green-700">
              Try Again
            </Button>
            <Button 
              onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'menu' }))}
              variant="outline"
            >
              Main Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameState.gameStatus === 'levelComplete') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-yellow-100 to-yellow-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-yellow-800 mb-4">Level Complete!</h2>
          <p className="text-yellow-600 mb-4">Great job! The panda ate all the healthy food!</p>
          <p className="text-lg font-semibold mb-6">Score: {gameState.score}</p>
          <Button onClick={nextLevel} className="bg-green-600 hover:bg-green-700">
            Next Level ({gameState.level + 1})
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-100 to-green-200 p-4">
      {/* Game UI */}
      <div className="mb-4 flex flex-wrap gap-4 justify-center">
        <div className="bg-white rounded-lg px-4 py-2 shadow-md">
          <span className="font-semibold text-green-800">Score: {gameState.score}</span>
        </div>
        <div className="bg-white rounded-lg px-4 py-2 shadow-md">
          <span className="font-semibold text-green-800">Level: {gameState.level}</span>
        </div>
        <div className="bg-white rounded-lg px-4 py-2 shadow-md">
          <span className="font-semibold text-green-800">Health: </span>
          <div className="inline-block w-20 h-2 bg-gray-200 rounded-full ml-2">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${gameState.health}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-2 shadow-md">
          <span className="font-semibold text-green-800">Time: </span>
          <span className={`font-mono ${gameState.timeLeft <= 10 ? 'text-red-600' : 'text-green-800'}`}>
            {formatTime(gameState.timeLeft)}
          </span>
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={gameAreaRef}
        className="relative bg-green-50 border-4 border-green-300 rounded-lg shadow-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-500"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        tabIndex={0}
        onClick={() => gameAreaRef.current?.focus()}
        onMouseEnter={() => gameAreaRef.current?.focus()}
      >
        {/* Walls */}
        {gameState.walls.map(wall => (
          <div
            key={wall.id}
            className="absolute bg-stone-600 border border-stone-700 rounded-sm"
            style={{
              left: wall.position.x,
              top: wall.position.y,
              width: wall.width,
              height: wall.height,
            }}
          />
        ))}

        {/* Panda */}
        <div
          className="absolute text-4xl transition-all duration-75 ease-linear z-10"
          style={{
            left: gameState.panda.x,
            top: gameState.panda.y,
            width: PANDA_SIZE,
            height: PANDA_SIZE,
          }}
        >
          🐼
        </div>

        {/* Food Items */}
        {gameState.foods.map(food => (
          <div
            key={food.id}
            className="absolute text-2xl z-5"
            style={{
              left: food.position.x,
              top: food.position.y,
              width: FOOD_SIZE,
              height: FOOD_SIZE,
            }}
          >
            {food.emoji}
          </div>
        ))}

        {/* Instructions overlay */}
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-2 text-xs text-green-700">
          <div>Use arrow keys to move</div>
          <div className="text-green-500 mt-1">Click here if keys don't work</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="mt-4 text-center text-green-600">
        <p className="text-sm">🎋 Eat healthy foods • 🍔 Avoid junk food • 🧱 Navigate around walls • ⏰ Beat the timer!</p>
      </div>
    </div>
  )
}

export default PandaGame