///////////////////
// Constants and utility functions
///////////////////

const pi = Math.PI
const abs = Math.abs
const genAngle = (angle) => {
  while (angle < 0) {
    angle += 2 * pi
  }

  while (angle > 2 * pi) {
    angle -= 2 * pi
  }

  return angle
}
const dist = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
const sin = Math.sin
const cos = Math.cos
const acos = Math.acos
const atan2 = Math.atan2
const min = Math.min
const max = Math.max
const getRandomColor = () => {
  let letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
const areaOfPoly = (vertices) => {
  const n = vertices.length

  let area = 0
  // divide into triangles and add areas of triangles
  const [x1, y1] = vertices[0]
  for (let i = 1; i < n - 1; i++) {
    const [x2, y2] = vertices[i]
    const [x3, y3] = vertices[i + 1]
    area += 0.5 * abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  }

  return area
}

///////////////////
// Canvas setup
///////////////////

HTMLCanvasElement.prototype.clear = function () { this.getContext('2d').clearRect(0, 0, this.width, this.height) }

const canvasRobot = document.getElementById('robot_space')
canvasRobot.width = 400
canvasRobot.height = 400

const canvasConfig = document.getElementById('configuration_space')
canvasConfig.width = canvasRobot.width
canvasConfig.height = canvasRobot.height

const canvasWorkspace = document.getElementById('workspace')
canvasWorkspace.width = canvasRobot.width
canvasWorkspace.height = canvasRobot.height

///////////////////
// Obstacles
///////////////////

class Cursor {
  constructor(canvas) {
    this.canvas = canvas
  }

  draw(mouseX, mouseY) {
    const c = this.canvas.getContext('2d')

    c.lineWidth = 1
    c.strokeStyle = "grey"

    // vertical line
    c.beginPath()
    c.moveTo(mouseX, 0)
    c.lineTo(mouseX, this.canvas.height)
    c.closePath()
    c.stroke()

    // horizontal line
    c.beginPath()
    c.moveTo(0, mouseY)
    c.lineTo(this.canvas.width, mouseY)
    c.closePath()
    c.stroke()
  }
}

class Obstacle {
  constructor(vertices) {
    this.vertices = vertices
    this.color = getRandomColor()
  }

  drawInRobotSpace(canvas) {
    if (this.vertices.length === 0) { return null }

    const c = canvas.getContext('2d')

    c.beginPath()
    c.moveTo(this.vertices[0][0], this.vertices[0][1])
    for (let i = 1; i < this.vertices.length; i++) {
      c.lineTo(this.vertices[i][0], this.vertices[i][1])
    }
    c.closePath()
    c.fillStyle = this.color
    c.fill()
  }

  collisionCheck(arm) {
    const w = arm.w
    const J0 = arm.J0
    const J1 = arm.J1
    const { theta1, theta2 } = arm.config

    const rotatePointAboutPoint = (point, pivot, theta) => {
      return [
        point[0] * cos(theta) - point[1] * sin(theta) + pivot[0],
        point[0] * sin(theta) + point[1] * cos(theta) + pivot[1]
      ]
    }

    const isPointInsidePoly = (point, vertices) => {
      const n = vertices.length

      let __area = 0
      for (let i = 0; i < n; i++) {
        __area += areaOfPoly([point, vertices[i], vertices[(i + 1) % n]])
      }

      return __area <= areaOfPoly(vertices)
    }

    const cross2D = (edge1, edge2) => (edge1[0] * edge2[1] - edge2[0] * edge1[1])

    const isEdgeCrossingEdge = (line1, line2) => {
      // convert to vector form
      const edge1 = [line1[1][0] - line1[0][0], line1[1][1] - line1[0][1]]
      const edge2 = [line2[1][0] - line2[0][0], line2[1][1] - line2[0][1]]

      const tempEdge11 = [line2[0][0] - line1[0][0], line2[0][1] - line1[0][1]]
      const tempEdge12 = [line2[1][0] - line1[0][0], line2[1][1] - line1[0][1]]
      const tempEdge21 = [line1[0][0] - line2[0][0], line1[0][1] - line2[0][1]]
      const tempEdge22 = [line1[1][0] - line2[0][0], line1[1][1] - line2[0][1]]

      const check1 = cross2D(edge1, tempEdge11) * cross2D(edge1, tempEdge12) < 0
      const check2 = cross2D(edge2, tempEdge21) * cross2D(edge2, tempEdge22) < 0

      return check1 && check2
    }

    const isPolyInsidePoly = (vertices1, vertices2) => {
      for (let v of vertices1) {
        if (isPointInsidePoly(v, vertices2)) {
          return true
        }
      }

      for (let v of vertices2) {
        if (isPointInsidePoly(v, vertices1)) {
          return true
        }
      }

      return false
    }

    const isPolyCrossingPoly = (vertices1, vertices2) => {
      const n1 = vertices1.length
      const n2 = vertices2.length
      for (let i = 0; i < n1; i++) {
        const line1 = [vertices1[i], vertices1[(i + 1) % n1]]
        for (let j = 0; j < n2; j++) {
          const line2 = [vertices2[j], vertices2[(j + 1) % n2]]
          if (isEdgeCrossingEdge(line1, line2)) {
            return true
          }
        }
      }

      return false
    }

    const L1 = []
    L1.push(rotatePointAboutPoint([0, w / 2], [J0.x, J0.y], theta1))
    L1.push(rotatePointAboutPoint([0, -w / 2], [J0.x, J0.y], theta1))
    L1.push(rotatePointAboutPoint([arm.l1, w / 2], [J0.x, J0.y], theta1))
    L1.push(rotatePointAboutPoint([arm.l1, -w / 2], [J0.x, J0.y], theta1))

    const L2 = []
    L2.push(rotatePointAboutPoint([0, w / 2], [J1.x, J1.y], theta1 + theta2))
    L2.push(rotatePointAboutPoint([0, -w / 2], [J1.x, J1.y], theta1 + theta2))
    L2.push(rotatePointAboutPoint([arm.l2, w / 2], [J1.x, J1.y], theta1 + theta2))
    L2.push(rotatePointAboutPoint([arm.l2, -w / 2], [J1.x, J1.y], theta1 + theta2))

    let isCollision = isPolyInsidePoly(L1, this.vertices) || isPolyInsidePoly(L2, this.vertices) || isPolyCrossingPoly(L1, this.vertices) || isPolyCrossingPoly(L2, this.vertices)

    return isCollision
  }
}

class Obstacles {
  constructor(canvasRobot, canvasConfig, canvasWorkspace) {
    this.obstacles = []

    this.canvasR = canvasRobot
    this.canvasC = canvasConfig
    this.canvasW = canvasWorkspace
  }

  add(obstacle) {
    const vertices = (obstacle instanceof Obstacle) ? obstacle.vertices : obstacle

    if (areaOfPoly(vertices) > 0) {
      this.obstacles.push((obstacle instanceof Array) ? new Obstacle(obstacle) : obstacle)
    }
  }

  removeAll() {
    this.obstacles = []
  }

  drawInRobotSpace() {
    this.obstacles.forEach(el => el.drawInRobotSpace(this.canvasR))
  }

  collisionCheck(arm) {
    for (let obstacle of this.obstacles) {
      if (obstacle.collisionCheck(arm)) {
        return true
      }
    }
    return false
  }
}

const obstacles = new Obstacles(canvasRobot, canvasConfig, canvasWorkspace)
// starting obstacles
obstacles.add([[284, 273], [315, 239], [346, 278]])
obstacles.add([[122, 248], [80, 200], [51, 226], [74, 276]])
obstacles.add([[200, 100], [265, 121], [324, 74], [267, 31], [206, 43]])

const cursorR = new Cursor(canvas = canvasRobot)
const drawVertices = (vertices, canvas = canvasRobot) => {
  const c = canvas.getContext('2d')
  c.fillStyle = 'white'

  for (let v of vertices) {
    c.beginPath()
    c.arc(v[0], v[1], 2, 0, 2 * pi, false)
    c.closePath()
    c.fill()
  }
}

const addObstacleBtn = document.getElementById('add_obstacle')
const verticesInput = document.getElementById('obstacle_vertices')
const clearObstaclesBtn = document.getElementById('clear_obstacles')

addObstacleBtn.addEventListener('click', () => {
  const n = Number(verticesInput.value)
  const vertices = []

  const controller = new AbortController()

  canvasRobot.addEventListener('mousemove', (e) => {

    // update only the robot space canvas not the others
    canvasRobot.clear()
    robotspace.draw()
    obstacles.drawInRobotSpace()

    // parts only visible during obstacle creation
    cursorR.draw(e.offsetX, e.offsetY)
    drawVertices(vertices, canvasRobot)

  }, controller)

  canvasRobot.addEventListener('click', (e) => {
    vertices.push([e.offsetX, e.offsetY])

    if (vertices.length === n) {
      // when all the vertices are placed,
      // add too obstacle list
      obstacles.add(vertices)
      // and redraw all canvases
      drawAll()

      controller.abort()
    }
  }, controller)
})

clearObstaclesBtn.addEventListener('click', () => {
  obstacles.removeAll()

  canvasRobot.clear()
  canvasConfig.clear()
  canvasWorkspace.clear()

  drawAll()
})

///////////////////
// Robot arm and spaces
///////////////////

class Robot {
  constructor(x, y, l1, l2, theta1, theta2) {
    this.w = 10 // px

    this.x = x // px
    this.y = y // px
    this.l1 = l1 // px
    this.l2 = l2 // px

    this.theta1_init = theta1 * pi / 180 // rads
    this.theta2_init = theta2 * pi / 180 // rads
    this.__theta1 = this.theta1_init
    this.__theta2 = this.theta2_init

    this.dtheta1 = 5 * pi / 180 // rads
    this.dtheta2 = 5 * pi / 180 // rads

    this.routineIsDone = false
  }

  set config(val) {
    this.__theta1 = val.theta1 ?? this.__theta1
    this.__theta2 = val.theta2 ?? this.__theta2
    drawAll()
  }

  get config() {
    return {
      theta1: this.__theta1,
      theta2: this.__theta2
    }
  }

  get J0() {
    return { x: this.x, y: this.y }
  }

  get J1() {
    return {
      x: this.x + this.l1 * Math.cos(this.__theta1),
      y: this.y + this.l1 * Math.sin(this.__theta1)
    }
  }

  get endEffector() {
    const x = this.x + this.l1 * Math.cos(this.__theta1) + this.l2 * Math.cos(this.__theta1 + this.__theta2)
    const y = this.y + this.l1 * Math.sin(this.__theta1) + this.l2 * Math.sin(this.__theta1 + this.__theta2)

    return { x, y }
  }
}

class RobotSpace {
  constructor(robotArm, canvas) {
    this.canvas = canvas
    this.arm = robotArm

    this.linkColor = "#000"
    this.jointColor = "#f00a"
  }

  draw() {
    const c = this.canvas.getContext('2d')

    const J0 = this.arm.J0
    const J1 = this.arm.J1
    const EE = this.arm.endEffector

    const w = this.arm.w

    c.lineWidth = this.arm.w
    c.strokeStyle = this.linkColor

    // draw link 1 (J0 to J1)
    c.beginPath()
    c.moveTo(J0.x, J0.y)
    c.lineTo(J1.x, J1.y)
    c.closePath()
    c.stroke()

    // draw link 2 (J1 to endEffector)
    c.beginPath()
    c.moveTo(J1.x, J1.y)
    c.lineTo(EE.x, EE.y)
    c.closePath()
    c.stroke()

    // draw joint 0
    c.beginPath()
    c.arc(J0.x, J0.y, w / 2, 0, 2 * pi, false)
    c.closePath()
    c.fillStyle = this.jointColor
    c.fill()

    // draw joint 1
    c.beginPath()
    c.arc(J1.x, J1.y, w / 2, 0, 2 * pi, false)
    c.closePath()
    c.fillStyle = this.jointColor
    c.fill()

    // draw endEffector
    c.beginPath()
    c.arc(EE.x, EE.y, w / 2, 0, 2 * pi, false)
    c.closePath()
    c.fillStyle = this.jointColor
    c.fill()
  }

  updateArm(mouseX, mouseY, target) {
    const J0 = this.arm.J0
    const J1 = this.arm.J1

    let newConfig = {
      theta1: null,
      theta2: null
    }

    if (target === "J1") {
      let theta1 = atan2(mouseY - J0.y, mouseX - J0.x)

      newConfig.theta1 = genAngle(theta1)
    }
    else if (target === "EE") {
      let theta2 = atan2(mouseY - J1.y, mouseX - J1.x) - this.arm.config.theta1

      newConfig.theta2 = genAngle(theta2)
    }

    arm.config = newConfig
  }
}

class ConfigurationSpace {
  constructor(robotArm, canvas) {
    this.canvas = canvas
    this.arm = robotArm

    this.color = "#fff"
  }

  draw(color) {
    const c = this.canvas.getContext('2d')
    const scaleX = this.canvas.width / (2 * pi)
    const scaleY = this.canvas.height / (2 * pi)

    const { theta1, theta2 } = this.arm.config

    const size = 1 // radius of marked point

    // plot the current configuration point
    c.beginPath()
    c.arc(genAngle(theta1) * scaleX, genAngle(theta2) * scaleY, size, 0, 2 * pi, false)
    c.closePath()
    c.fillStyle = color ?? this.color
    c.fill()
  }

  updateArm(mouseX, mouseY) {
    this.arm.config = {
      theta1: 2 * pi * mouseX / this.canvas.width,
      theta2: 2 * pi * mouseY / this.canvas.height
    }
  }
}

class Workspace {
  constructor(robotArm, canvas) {
    this.canvas = canvas
    this.arm = robotArm

    this.color = "#fff"
    this.boundaryColor = "#0f0"
  }

  draw(color, boundaryColor) {
    const c = this.canvas.getContext('2d')

    const l1 = this.arm.l1
    const l2 = this.arm.l2

    const J0 = this.arm.J0
    const EE = arm.endEffector

    const size = 2 // radius of marked point

    // plot workspace bounds: [max(L1-L2, 0), L1+L2]
    c.beginPath()
    c.arc(J0.x, J0.y, max(l1 - l2, 0) - size, 0, 2 * pi, false)
    c.closePath()
    c.lineWidth = 2
    c.strokeStyle = boundaryColor ?? this.boundaryColor
    c.stroke()

    c.beginPath()
    c.arc(J0.x, J0.y, (l1 + l2) + size, 0, 2 * pi, false)
    c.closePath()
    c.lineWidth = 2
    c.strokeStyle = this.boundaryColor
    c.stroke()

    // plot workspace point
    c.beginPath()
    c.arc(EE.x, EE.y, size, 0, 2 * pi, false)
    c.closePath()
    c.fillStyle = color ?? this.color
    c.fill()
  }

  robotArmIK(x, y, solutionSet = 0) {
    // inverse kinematic solution for mapping workspace to robot space
    const J0 = this.arm.J0

    const L1 = this.arm.l1
    const L2 = this.arm.l2
    const d = dist(x, y, J0.x, J0.y)

    const beta = acos((L2 ** 2 + d ** 2 - L1 ** 2) / (2 * d * L2))
    const gamma = acos((L1 ** 2 + d ** 2 - L2 ** 2) / (2 * d * L1))
    const alpha = atan2(y - J0.y, x - J0.x)

    if (d < max(L1 - L2, 0) || d > L1 + L2) {
      // real solution doesn't exist
      return {
        theta1: genAngle(alpha),
        theta2: (d < max(L1 - L2, 0)) ? pi : 0
      }
    }

    const solutions = [
      {
        theta1: genAngle(alpha - gamma),
        theta2: genAngle(beta + gamma)
      },
      {
        theta1: genAngle(alpha + gamma),
        theta2: genAngle(-beta - gamma)
      }
    ]

    return solutions[solutionSet]
  }

  updateArm(mouseX, mouseY, solutionSet) {
    this.arm.config = this.robotArmIK(mouseX, mouseY, solutionSet)
  }
}

const arm = new Robot(canvasRobot.width / 2, canvasRobot.height / 2, 80, 40, 0, 0)

const robotspace = new RobotSpace(arm, canvas = canvasRobot)
const configspace = new ConfigurationSpace(arm, canvas = canvasConfig)
const workspace = new Workspace(arm, canvas = canvasWorkspace)

// for making robot space interactive
canvasRobot.addEventListener('mousedown', (eDown) => {
  const controller = new AbortController()

  const initMouseX = eDown.offsetX
  const initMouseY = eDown.offsetY

  const isWithinThreshold = (target, threshold = 20) => abs(target.x - initMouseX) < threshold && abs(target.y - initMouseY) < threshold

  let target
  if (isWithinThreshold(arm.J1)) target = "J1"
  else if (isWithinThreshold(arm.endEffector)) target = "EE"

  window.addEventListener('mouseup', () => {
    controller.abort()
  }, controller)

  canvasRobot.addEventListener('mousemove', (eMove) => {
    robotspace.updateArm(eMove.offsetX, eMove.offsetY, target)
  }, controller)
})

// mapping configuration space to robot space
canvasConfig.addEventListener('mousedown', (eDown) => {
  const controller = new AbortController()

  configspace.updateArm(eDown.offsetX, eDown.offsetY)

  window.addEventListener('mouseup', () => {
    controller.abort()
  }, controller)

  canvasConfig.addEventListener('mousemove', (eMove) => {
    configspace.updateArm(eMove.offsetX, eMove.offsetY)
  }, controller)
})

// mapping workspace to robot space
canvasWorkspace.addEventListener('mousedown', (eDown) => {
  const solutionSet = eDown.button === 0 ? 0 : 1 // 0:left-click | 2: right-click

  const controller = new AbortController()

  workspace.updateArm(eDown.offsetX, eDown.offsetY, solutionSet)

  window.addEventListener('mouseup', () => {
    controller.abort()
  }, controller)

  canvasWorkspace.addEventListener('mousemove', (eMove) => {
    workspace.updateArm(eMove.offsetX, eMove.offsetY, solutionSet)
  }, controller)
})

// disable right-click context menu on all canvas
canvasRobot.addEventListener('contextmenu', (e) => e.preventDefault())
canvasConfig.addEventListener('contextmenu', (e) => e.preventDefault())
canvasWorkspace.addEventListener('contextmenu', (e) => e.preventDefault())

///////////////////

function drawAll() {
  // clear the previous robot space frame
  canvasRobot.clear()

  // draw obstacles
  obstacles.drawInRobotSpace()

  // check collisions and get the first colliding obstacle's color
  const collisionColor = obstacles.obstacles.find(el => el.collisionCheck(arm))?.color

  // drawing robot arm, respective workspace, and configuration space
  robotspace.draw()
  configspace.draw(color = collisionColor)
  workspace.draw(color = collisionColor)
}
drawAll()

///////////////////
// Routine
///////////////////

let isPlaying = false
function startRoutine() {
  if (!isPlaying) {
    return null
  }

  let { theta1, theta2 } = arm.config

  requestAnimationFrame(startRoutine)
  if (theta2 < 2 * pi + arm.theta2_init) {
    theta2 = min(theta2 + arm.dtheta2, 2 * pi + arm.theta2_init)
  } else {
    theta2 = arm.theta2_init
    theta1 = min(theta1 + arm.dtheta1, 2 * pi + arm.theta1_init)
  }

  if (theta1 >= 2 * pi + arm.theta1_init) {
    theta1 = arm.theta1_init
  }

  arm.config = { theta1, theta2 }

  drawAll()
}

const playBtn = document.getElementById('play')
const stopBtn = document.getElementById('stop')

playBtn.addEventListener('click', () => {
  isPlaying = true

  const currentConfig = arm.config
  arm.theta1_init = currentConfig.theta1
  arm.theta2_init = 0 // currentConfig.theta2

  playBtn.classList.add('hidden')
  stopBtn.classList.remove('hidden')

  startRoutine()
})

stopBtn.addEventListener('click', () => {
  isPlaying = false

  playBtn.classList.remove('hidden')
  stopBtn.classList.add('hidden')
})