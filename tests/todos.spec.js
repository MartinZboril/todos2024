import test from "ava"
import supertest from "supertest"
import { app } from "../src/app.js"
import { db } from "../src/db.js"

test.beforeEach(async () => {
  await db.migrate.latest()
})

test.afterEach(async () => {
  await db.migrate.rollback()
})

test.serial("it renders a list of todos", async (t) => {
  const response = await supertest.agent(app).get("/")

  t.assert(response.text.includes("<h1>Todos</h1>"))
})

test.serial("create new todo", async (t) => {
  await db("todos").insert({
    title: "Moje todo",
  })

  const response = await supertest.agent(app).get("/")

  t.assert(response.text.includes("Moje todo"))
})

test.serial("create new todo via form", async (t) => {
  const response = await supertest
    .agent(app)
    .post("/add-todo")
    .type("form")
    .send({ title: "Nějaký název" })
    .redirects(1)

  t.assert(response.text.includes("Nějaký název"))
})

// Custom tests

test.serial("toggle todo", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
    done: false,
  })

  const insertResponse = await supertest.agent(app).get("/")

  t.assert(insertResponse.text.includes("nehotovo"))

  const toggleResponse = await supertest.agent(app)
    .get(`/toggle-todo/${todo}`)
    .redirects(1)

  t.assert(toggleResponse.text.includes("hotovo"))
})

test.serial("toggle todo which doesn't exist", async (t) => {
  const response = await supertest.agent(app)
    .get("/toggle-todo/X")
    .redirects(1)

  t.assert(response.status === 404)
  t.assert(response.text.includes("Todo nebylo nalezeno"))
})

test.serial("update todo via form", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
  })

  const response = await supertest
    .agent(app)
    .post(`/update-todo/${todo}`)
    .type("form")
    .send({ title: "Nějaký název", priority: "high" })
    .redirects(1)

  t.assert(response.text.includes("Nějaký název"))
  t.assert(response.text.includes("high"))
})

test.serial("update todo which doesn't exist", async (t) => {
  const response = await supertest
    .agent(app)
    .post("/update-todo/X")
    .type("form")
    .send({ title: "Nějaký název", priority: "high" })
    .redirects(1)

  t.assert(response.status === 404)
  t.assert(response.text.includes("Todo nebylo nalezeno"))
})

test.serial("delete todo", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
  })

  const insertResponse = await supertest.agent(app).get("/")

  t.assert(insertResponse.text.includes("Moje todo"))

  const deleteResponse = await supertest.agent(app)
    .get(`/remove-todo/${todo}`)
    .redirects(1)

  t.assert(! deleteResponse.text.includes("Moje todo"))
})

test.serial("delete todo which doesn't exist", async (t) => {
  const response = await supertest.agent(app)
    .get("/remove-todo/X")
    .redirects(1)

  t.assert(response.status === 404)
  t.assert(response.text.includes("Todo nebylo nalezeno"))
})

test.serial("show todo detail", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
  })

  const response = await supertest.agent(app).get(`/todo/${todo}`)

  t.assert(response.text.includes("Moje todo"))
})

test.serial("show todo which doesn't exist", async (t) => {
  const response = await supertest.agent(app).get(`/todo/X`)

  t.assert(response.status === 404)
  t.assert(response.text.includes("Todo nebylo nalezeno"))
})

test.serial("create new todo via form without a title", async (t) => {
  const response = await supertest
    .agent(app)
    .post("/add-todo")
    .type("form")
    .send({ title: "" })
    .redirects(1)

  t.assert(response.text.includes("Todo musí mít vyplněný název"))
})

test.serial("update todo via form without a title", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
  })

  const response = await supertest
    .agent(app)
    .post(`/update-todo/${todo}`)
    .type("form")
    .send({ priority: "high" })
    .redirects(1)

  t.assert(response.text.includes("Todo musí mít vyplněný název"))
})

test.serial("update todo via form without a priority", async (t) => {
  const todo = await db("todos").insert({
    title: "Moje todo",
  })

  const response = await supertest
    .agent(app)
    .post(`/update-todo/${todo}`)
    .type("form")
    .send({ title: "Moje todo" })
    .redirects(1)

  t.assert(response.text.includes("Todo musí mít přiřazenou prioritu"))
})

// TODO: check if updated todo has priority in allowed value