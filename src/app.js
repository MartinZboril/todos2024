import session from 'express-session'
import flash from 'connect-flash'
import dotenv from 'dotenv'
import express from "express"
import { db, getAllTodos, getTodoById } from "./db.js"
import {
  sendTodoDeletedToAllConnections,
  sendTodoDetailToAllConnections,
  sendTodoListToAllConnections,
} from "./websockets.js"

dotenv.config()

async function checkTodoExists(req, res, next) {
  const todo = await getTodoById(req.params.id)

  if (!todo) {
    res.status(404)
    return res.send("404 - Todo nebylo nalezeno")
  }

  req.todo = todo
  next()
}

export const app = express()

app.set("view engine", "ejs")

app.use(express.static("public"))
app.use(express.urlencoded({ extended: true }))

app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: true,
  resave: false
}))

app.use(flash())

app.use((req, res, next) => {
  console.log("Incomming request", req.method, req.url)
  res.locals.messages = req.flash()
  next()
})

app.get("/", async (req, res) => {
  const todos = await getAllTodos()

  res.render("index", {
    title: "Todos",
    todos,
  })
})

app.get("/todo/:id", checkTodoExists, async (req, res, next) => {
  const todo = await getTodoById(req.params.id)

  if (!todo) return next()

  res.render("todo", {
    todo,
  })
})

app.post("/add-todo", async (req, res) => {
  const { title } = req.body
  const errors = []

  if (!title || title.trim().length === 0) {
    errors.push("Todo musí mít vyplněný název")
  }

  if (errors.length > 0) {
    errors.forEach(error => {
      req.flash('error', error)
    })
    return res.redirect("/")
  }

  const todo = {
    title: req.body.title,
    done: false,
  }

  await db("todos").insert(todo)

  res.redirect("/")
})

app.post("/update-todo/:id", checkTodoExists, async (req, res, next) => {
  const todo = await getTodoById(req.params.id)

  if (!todo) return next()

  const { title, priority } = req.body
  const errors = []

  if (!title || title.trim().length === 0) {
    errors.push("Todo musí mít vyplněný název")
  }

  if (!priority || priority.trim().length === 0) {
    errors.push("Todo musí mít přiřazenou prioritu")
  }

  if (errors.length > 0) {
    errors.forEach(error => {
      req.flash('error', error)
    })
    return res.redirect(`/todo/${todo.id}`)
  }

  const query = db("todos").where("id", todo.id)

  if (req.body.title) {
    query.update({ title: req.body.title })
  }

  if (req.body.priority) {
    query.update({ priority: req.body.priority })
  }

  await query

  sendTodoListToAllConnections()
  sendTodoDetailToAllConnections(todo.id)

  res.redirect("back")
})

app.get("/remove-todo/:id", checkTodoExists, async (req, res) => {
  const todo = await getTodoById(req.params.id)

  if (!todo) return next()

  await db("todos").delete().where("id", todo.id)

  sendTodoListToAllConnections()
  sendTodoDeletedToAllConnections(todo.id)

  res.redirect("/")
})

app.get("/toggle-todo/:id", checkTodoExists, async (req, res, next) => {
  const todo = await getTodoById(req.params.id)

  if (!todo) return next()

  await db("todos")
    .update({ done: !todo.done })
    .where("id", todo.id)

  sendTodoListToAllConnections()
  sendTodoDetailToAllConnections(todo.id)

  res.redirect("back")
})

app.use((req, res) => {
  res.status(404)
  res.send("404 - Stránka nenalezena")
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500)
  res.send("500 - Chyba na straně serveru")
})
