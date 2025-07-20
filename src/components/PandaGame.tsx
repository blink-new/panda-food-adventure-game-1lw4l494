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
  gameStatus: 'menu' | 'playing' | 'gameOver' | 'levelComplete' | 'gameWon'
  keysPressed: Set<string>
  goodFoodCollected: number
  totalGoodFood: number
  hasReachedEnd: boolean
}

const GAME_WIDTH = 800
const GAME_HEIGHT = 600
const PANDA_SIZE = 30
const FOOD_SIZE = 25
const PANDA_SPEED = 4
const CELL_SIZE = 40

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

// Maze layouts for different levels with guaranteed solvable paths
const MAZE_LAYOUTS = [
  // Level 1 - Simple maze with clear path
  {
    layout: [
      "####################",
      "#S.....#...........#",
      "#.####.#.#########.#",
      "#....#...#.......#.#",
      "####.#####.#####.#.#",
      "#..........#...#...#",
      "#.########.#.#.###.#",
      "#.#......#...#.....#",
      "#.#.####.#########.#",
      "#...#..............E",
      "####################"
    ],
    goodFoodPositions: [
      {row: 1, col: 2}, {row: 1, col: 4}, {row: 3, col: 2}, 
      {row: 5, col: 2}, {row: 7, col: 3}, {row: 9, col: 4}
    ],
    badFoodPositions: [
      {row: 1, col: 12}, {row: 3, col: 15}, {row: 7, col: 17}
    ]
  },
  // Level 2 - Fixed maze with proper escape route
  {
    layout: [
      "####################",
      "#S.................#",
      "#.################.#",
      "#................#.#",
      "################.#.#",
      "#................#.#",
      "#.################.#",
      "#..................#",
      "##################.#",
      "#..................E",
      "####################"
    ],
    goodFoodPositions: [
      {row: 1, col: 3}, {row: 1, col: 8}, {row: 3, col: 5}, 
      {row: 3, col: 12}, {row: 5, col: 3}, {row: 7, col: 8}, 
      {row: 9, col: 5}, {row: 9, col: 15}
    ],
    badFoodPositions: [
      {row: 1, col: 15}, {row: 5, col: 15}, {row: 7, col: 3}
    ]
  },
  // Level 3 - Advanced maze with multiple paths
  {
    layout: [
      "####################",
      "#S.......#.........#",
      "#.#######.#.#####.##",
      "#.......#.#.....#..#",
      "#######.#.#####.##.#",
      "#.......#.......#..#",
      "#.#######.#######.##",
      "#.......#.........##",
      "#.#####.###########E",
      "#...................#",
      "####################"
    ],
    goodFoodPositions: [
      {row: 1, col: 3}, {row: 1, col: 6}, {row: 3, col: 3}, 
      {row: 3, col: 13}, {row: 5, col: 3}, {row: 5, col: 13}, 
      {row: 7, col: 3}, {row: 9, col: 3}, {row: 9, col: 8}, {row: 9, col: 15}
    ],
    badFoodPositions: [
      {row: 1, col: 15}, {row: 3, col: 8}, {row: 7, col: 12}, {row: 9, col: 12}
    ]
  }
]

const PandaGame: React.FC = () => {
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()
  
  const [gameState, setGameState] = useState<GameState>({
    panda: { x: 0, y: 0 },
    foods: [],
    walls: [],
    score: 0,
    health: 100,
    level: 1,
    gameStatus: 'menu',
    keysPressed: new Set(),
    goodFoodCollected: 0,
    totalGoodFood: 0,
    hasReachedEnd: false
  })

  const checkCollision = useCallback((pos1: Position, pos2: Position, size1: number, size2: number): boolean => {
    return (
      pos1.x < pos2.x + size2 &&
      pos1.x + size1 > pos2.x &&
      pos1.y < pos2.y + size2 &&
      pos1.y + size1 > pos2.y
    )
  }, [])

  const generateMaze = useCallback((level: number) => {
    const mazeIndex = Math.min(level - 1, MAZE_LAYOUTS.length - 1)
    const mazeData = MAZE_LAYOUTS[mazeIndex]
    const maze = mazeData.layout
    
    const walls: Wall[] = []
    const foods: FoodItem[] = []
    let startPos = { x: 0, y: 0 }
    let endPos = { x: 0, y: 0 }
    
    // Calculate cell dimensions
    const cellWidth = GAME_WIDTH / maze[0].length
    const cellHeight = GAME_HEIGHT / maze.length
    
    // Helper function to check if a position is a valid open path (not a wall)
    const isValidFoodPosition = (row: number, col: number): boolean => {
      if (row < 0 || row >= maze.length || col < 0 || col >= maze[0].length) {
        return false
      }
      const cell = maze[row][col]
      return cell === '.' || cell === 'S' || cell === 'E' // Open path, start, or end
    }
    
    // Process maze layout for walls and positions
    maze.forEach((row, rowIndex) => {
      row.split('').forEach((cell, colIndex) => {
        const x = colIndex * cellWidth
        const y = rowIndex * cellHeight
        
        if (cell === '#') {
          // Wall
          walls.push({
            id: `wall-${rowIndex}-${colIndex}`,
            position: { x, y },
            width: cellWidth,
            height: cellHeight
          })
        } else if (cell === 'S') {
          // Start position
          startPos = { 
            x: x + cellWidth / 2 - PANDA_SIZE / 2, 
            y: y + cellHeight / 2 - PANDA_SIZE / 2 
          }
        } else if (cell === 'E') {
          // End position
          endPos = { x, y }
        }
      })
    })
    
    // Add good food at predefined positions (only if they're valid open paths)
    mazeData.goodFoodPositions.forEach((pos, index) => {
      if (isValidFoodPosition(pos.row, pos.col)) {
        const x = pos.col * cellWidth
        const y = pos.row * cellHeight
        const food = GOOD_FOODS[index % GOOD_FOODS.length]
        
        foods.push({
          id: `good-food-${index}`,
          type: 'good',
          emoji: food.emoji,
          position: { 
            x: x + cellWidth / 2 - FOOD_SIZE / 2, 
            y: y + cellHeight / 2 - FOOD_SIZE / 2 
          },
          points: food.points
        })
      } else {
        console.warn(`Good food position (${pos.row}, ${pos.col}) is in a wall, skipping...`)
      }
    })
    
    // Add bad food at predefined positions (only if they're valid open paths)
    mazeData.badFoodPositions.forEach((pos, index) => {
      if (isValidFoodPosition(pos.row, pos.col)) {
        const x = pos.col * cellWidth
        const y = pos.row * cellHeight
        const food = BAD_FOODS[index % BAD_FOODS.length]
        
        foods.push({
          id: `bad-food-${index}`,
          type: 'bad',
          emoji: food.emoji,
          position: { 
            x: x + cellWidth / 2 - FOOD_SIZE / 2, 
            y: y + cellHeight / 2 - FOOD_SIZE / 2 
          },
          points: food.points
        })
      } else {
        console.warn(`Bad food position (${pos.row}, ${pos.col}) is in a wall, skipping...`)
      }
    })
    
    // Count actual good food items placed (not the predefined count)
    const actualGoodFoodCount = foods.filter(food => food.type === 'good').length
    
    return { walls, foods, startPos, endPos, goodFoodCount: actualGoodFoodCount }
  }, [])

  const initializeLevel = useCallback((level: number) => {
    const { walls, foods, startPos, endPos, goodFoodCount } = generateMaze(level)
    
    setGameState(prev => ({
      ...prev,
      walls,
      foods,
      panda: startPos,
      gameStatus: 'playing',
      goodFoodCollected: 0,
      totalGoodFood: goodFoodCount,
      hasReachedEnd: false
    }))
  }, [generateMaze])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
      event.preventDefault()
      setGameState(prev => ({
        ...prev,
        keysPressed: new Set([...prev.keysPressed, event.key.toLowerCase()])
      }))
    }
  }, [])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setGameState(prev => {
      const newKeysPressed = new Set(prev.keysPressed)
      newKeysPressed.delete(event.key.toLowerCase())
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
      const moveSpeed = PANDA_SPEED
      
      if (prev.keysPressed.has('arrowup') || prev.keysPressed.has('w')) {
        const testY = Math.max(0, newPanda.y - moveSpeed)
        const testPanda = { ...newPanda, y: testY }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, wall.width))) {
          newPanda = { ...newPanda, y: testY }
        }
      }
      if (prev.keysPressed.has('arrowdown') || prev.keysPressed.has('s')) {
        const testY = Math.min(GAME_HEIGHT - PANDA_SIZE, newPanda.y + moveSpeed)
        const testPanda = { ...newPanda, y: testY }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, wall.width))) {
          newPanda = { ...newPanda, y: testY }
        }
      }
      if (prev.keysPressed.has('arrowleft') || prev.keysPressed.has('a')) {
        const testX = Math.max(0, newPanda.x - moveSpeed)
        const testPanda = { ...newPanda, x: testX }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, wall.width))) {
          newPanda = { ...newPanda, x: testX }
        }
      }
      if (prev.keysPressed.has('arrowright') || prev.keysPressed.has('d')) {
        const testX = Math.min(GAME_WIDTH - PANDA_SIZE, newPanda.x + moveSpeed)
        const testPanda = { ...newPanda, x: testX }
        if (!prev.walls.some(wall => checkCollision(testPanda, wall.position, PANDA_SIZE, wall.width))) {
          newPanda = { ...newPanda, x: testX }
        }
      }

      // Check food collisions
      let newScore = prev.score
      let newHealth = prev.health
      let newGoodFoodCollected = prev.goodFoodCollected
      
      const newFoods = prev.foods.filter(food => {
        if (checkCollision(newPanda, food.position, PANDA_SIZE, FOOD_SIZE)) {
          newScore += food.points
          if (food.type === 'good') {
            newHealth = Math.min(100, newHealth + 5)
            newGoodFoodCollected++
          } else {
            newHealth = Math.max(0, newHealth - 15)
          }
          return false // Remove eaten food
        }
        return true
      })

      // Check if reached end position (right edge of the game area)
      const hasReachedEnd = newPanda.x >= GAME_WIDTH - PANDA_SIZE - 10

      // Determine game status
      let newGameStatus = prev.gameStatus

      if (newHealth <= 0) {
        newGameStatus = 'gameOver'
      } else if (hasReachedEnd && newGoodFoodCollected === prev.totalGoodFood) {
        // Must collect ALL good food AND reach the end
        newGameStatus = 'levelComplete'
      } else if (hasReachedEnd && newGoodFoodCollected < prev.totalGoodFood) {
        // Reached end but didn't collect all good food
        newGameStatus = 'gameOver'
      }

      return {
        ...prev,
        panda: newPanda,
        foods: newFoods,
        score: newScore,
        health: newHealth,
        goodFoodCollected: newGoodFoodCollected,
        hasReachedEnd,
        gameStatus: newGameStatus
      }
    })
  }, [checkCollision])

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

  // Keyboard event listeners with improved focus handling
  useEffect(() => {
    const gameArea = gameAreaRef.current
    if (!gameArea) return

    // Always focus the game area when playing
    if (gameState.gameStatus === 'playing') {
      gameArea.focus()
    }

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

    // Add listeners to document for better reliability
    document.addEventListener('keydown', handleKeyDownWrapper, true)
    document.addEventListener('keyup', handleKeyUpWrapper, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDownWrapper, true)
      document.removeEventListener('keyup', handleKeyUpWrapper, true)
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
    if (newLevel > MAZE_LAYOUTS.length) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }))
      return
    }
    
    setGameState(prev => ({
      ...prev,
      level: newLevel
    }))
    initializeLevel(newLevel)
  }

  const restartGame = () => {
    startGame()
  }

  if (gameState.gameStatus === 'menu') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-100 to-green-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">🐼</div>
          <h1 className="text-3xl font-bold text-green-800 mb-4">Panda Maze Adventure</h1>
          <p className="text-green-600 mb-6">
            Navigate the maze from START to END! Collect ALL the healthy foods but avoid junk food to win each level.
          </p>
          <div className="text-sm text-green-500 mb-6">
            <p>🎋 🍎 🍇 = Good food (collect ALL to win!)</p>
            <p>🍔 🍕 🍭 = Bad food (avoid these!)</p>
            <p>🟫 = Walls (can't pass through)</p>
            <p className="mt-2 font-semibold">Use arrow keys or WASD to move</p>
            <p className="text-xs mt-2">You MUST collect all good food AND reach the end!</p>
          </div>
          <Button onClick={startGame} className="bg-green-600 hover:bg-green-700">
            Start Adventure
          </Button>
        </Card>
      </div>
    )
  }

  if (gameState.gameStatus === 'gameOver') {
    const reason = gameState.health <= 0 ? 
      "The panda ate too much junk food!" : 
      "You reached the end but didn't collect all the good food!"
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-100 to-red-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">😵</div>
          <h2 className="text-3xl font-bold text-red-800 mb-4">Game Over!</h2>
          <p className="text-red-600 mb-4">{reason}</p>
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
          <p className="text-yellow-600 mb-4">Amazing! You collected all the good food and reached the end!</p>
          <p className="text-lg font-semibold mb-6">Score: {gameState.score}</p>
          <Button onClick={nextLevel} className="bg-green-600 hover:bg-green-700">
            Next Level ({gameState.level + 1})
          </Button>
        </Card>
      </div>
    )
  }

  if (gameState.gameStatus === 'gameWon') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-100 to-purple-200">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-bold text-purple-800 mb-4">Congratulations!</h2>
          <p className="text-purple-600 mb-4">You've completed all the maze levels!</p>
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
          <span className="font-semibold text-green-800">
            Good Food: {gameState.goodFoodCollected}/{gameState.totalGoodFood}
          </span>
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={gameAreaRef}
        className="relative bg-green-50 border-4 border-green-300 rounded-lg shadow-lg overflow-hidden focus:outline-none focus:ring-4 focus:ring-green-500"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        tabIndex={0}
        onClick={() => gameAreaRef.current?.focus()}
        onMouseEnter={() => gameAreaRef.current?.focus()}
      >
        {/* Walls */}
        {gameState.walls.map(wall => (
          <div
            key={wall.id}
            className="absolute bg-stone-700 border border-stone-800"
            style={{
              left: wall.position.x,
              top: wall.position.y,
              width: wall.width,
              height: wall.height,
            }}
          />
        ))}

        {/* End zone indicator */}
        <div
          className="absolute bg-yellow-300 border-2 border-yellow-500 opacity-50"
          style={{
            right: 0,
            top: 0,
            width: 40,
            height: GAME_HEIGHT,
          }}
        >
          <div className="text-center text-yellow-800 font-bold text-xs mt-2 transform rotate-90">
            END
          </div>
        </div>

        {/* Start zone indicator */}
        <div
          className="absolute bg-blue-300 border-2 border-blue-500 opacity-50"
          style={{
            left: 0,
            top: 0,
            width: 40,
            height: GAME_HEIGHT,
          }}
        >
          <div className="text-center text-blue-800 font-bold text-xs mt-2 transform rotate-90">
            START
          </div>
        </div>

        {/* Panda */}
        <div
          className="absolute text-3xl transition-all duration-75 ease-linear z-20"
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
            className="absolute text-xl z-10"
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
        <div className="absolute top-4 left-4 bg-white bg-opacity-95 rounded-lg p-3 text-xs text-green-700 max-w-48">
          <div className="font-semibold">Controls:</div>
          <div>Arrow keys or WASD to move</div>
          <div className="mt-1 font-semibold">Goal:</div>
          <div>Collect ALL good food, then reach END</div>
          <div className="text-green-500 mt-1">Click here if keys don't work</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="mt-4 text-center text-green-600">
        <p className="text-sm">
          🎋 Collect ALL good foods • 🍔 Avoid junk food • 🏁 Reach the END zone to win!
        </p>
      </div>
    </div>
  )
}

export default PandaGame