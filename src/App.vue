<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue" // ^ placeholder
import {
  initDb,
  getTasks,
  addTask as dbAddTask,
  toggleTask as dbToggleTask,
  removeTask as dbRemoveTask,
} from "./db"

const THEME_KEY = "pulse-theme"

const time = ref(
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
)
const date = ref(
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
)
const isDark = ref(false)

function applyTheme(dark) {
  isDark.value = dark
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")
}

let clockTimer = null

function updateClock() {
  const now = new Date()
  time.value = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  date.value = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}


const SEARCH_ENGINES = [
  { id: "google", name: "Google", searchUrl: "https://www.google.com/search?q=" },
  { id: "duckduckgo", name: "DuckDuckGo", searchUrl: "https://duckduckgo.com/?q=" },
  { id: "bing", name: "Bing", searchUrl: "https://www.bing.com/search?q=" },
]
const SEARCH_ENGINE_KEY = "pulse-search-engine"

const searchQuery = ref("")
const searchEngineId = ref("google")
const searchInputRef = ref(null)

function currentEngine() {
  return SEARCH_ENGINES.find((e) => e.id === searchEngineId.value) ?? SEARCH_ENGINES[0]
}

function isLikelyUrl(q) {
 
  return /^https?:\/\//i.test(q) || /^[\w-]+\.[\w-]{2,}/.test(q)
}

function performSearch() {
  const q = searchQuery.value.trim()
  if (!q) {
    searchInputRef.value?.focus()
    return
  }
  if (isLikelyUrl(q)) {
    const href = /^https?:\/\//i.test(q) ? q : `https://${q}`
    window.location.href = href
    return
  }
  window.location.href = currentEngine().searchUrl + encodeURIComponent(q)
}

function selectEngine(id) {
  searchEngineId.value = id
  try {
    localStorage.setItem(SEARCH_ENGINE_KEY, id)
  } catch {
    /* ignore quota errors */
  }
  searchInputRef.value?.focus()
}

function onGlobalKeydown(e) {
  
  const tag = document.activeElement?.tagName
  const isEditable =
    document.activeElement?.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA"
  if (e.key === "/" && !isEditable) {
    e.preventDefault()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  }
}

onMounted(async () => {
 
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === "dark" || saved === "light") {
    applyTheme(saved === "dark")
  } else {
    applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches)
  }

  
  clockTimer = setInterval(updateClock, 1000)

 
  try {
    const storedEngine = localStorage.getItem(SEARCH_ENGINE_KEY)
    if (storedEngine && SEARCH_ENGINES.some((e) => e.id === storedEngine)) {
      searchEngineId.value = storedEngine
    }
  } catch {
  
  }


  window.addEventListener("keydown", onGlobalKeydown)


  try {
    await initDb()
    tasks.value = getTasks()
  } catch (err) {
    console.warn("[pulse] failed to load database:", err)
  }
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener("keydown", onGlobalKeydown)
})

function toggleTheme() {
  const next = !isDark.value
  applyTheme(next)
  localStorage.setItem(THEME_KEY, next ? "dark" : "light")
}

// Quick links — extend by adding { name, url } here.
const apps = ref([
  { name: "GitHub", url: "https://github.com", faviconFailed: false },
  { name: "YouTube", url: "https://youtube.com", faviconFailed: false },
  { name: "ChatGPT", url: "https://chat.openai.com", faviconFailed: false },
  { name: "Reddit", url: "https://reddit.com", faviconFailed: false },
])

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`
  } catch {
    return ""
  }
}


const taskInput = ref("")
const tasks = ref([])

const remainingTasks = computed(() => tasks.value.filter((t) => !t.done).length)

async function submitTask() {
  const text = taskInput.value.trim()
  if (!text) return
  taskInput.value = ""
  try {
    const id = await dbAddTask(text)
    if (id != null) {
      tasks.value.unshift({ id, text, done: false })
    }
  } catch (err) {
    console.warn("[pulse] failed to add task:", err)
  }
}

async function toggleTask(task) {
  task.done = !task.done
  try {
    await dbToggleTask(task.id, task.done)
  } catch (err) {
    console.warn("[pulse] failed to toggle task:", err)
    task.done = !task.done
  }
}

async function removeTask(id) {
  const previous = tasks.value
  tasks.value = previous.filter((t) => t.id !== id)
  try {
    await dbRemoveTask(id)
  } catch (err) {
    console.warn("[pulse] failed to remove task:", err)
    tasks.value = previous
  }
}
</script>

<template>
  <main class="page">
    <!-- Theme Toggle Button -->
    <button
      class="theme-toggle"
      @click="toggleTheme"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      <svg
        v-if="isDark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <span>{{ isDark ? "Light" : "Dark" }}</span>
    </button>

    <!-- Clock Section -->
    <section class="clock">
      <h1>{{ time }}</h1>
      <p>{{ date }}</p>
    </section>

    <!-- Search Section -->
    <section class="search" aria-label="Web search">
      <form class="search-bar" @submit.prevent="performSearch">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          :placeholder="`Search with ${currentEngine().name} or type a URL — press / to focus`"
          aria-label="Search query"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="search-clear"
          @click="searchQuery = ''; searchInputRef?.focus()"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <kbd class="search-shortcut" aria-hidden="true">/</kbd>
      </form>
      <div class="search-engines" role="tablist" aria-label="Search engine">
        <button
          v-for="engine in SEARCH_ENGINES"
          :key="engine.id"
          type="button"
          role="tab"
          :aria-selected="searchEngineId === engine.id"
          :class="['engine-pill', { active: searchEngineId === engine.id }]"
          @click="selectEngine(engine.id)"
        >
          {{ engine.name }}
        </button>
      </div>
    </section>


    <section class="widgets">

      <div class="card">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Quick Links
        </h2>
        <div class="app-list">
          <a
            v-for="app in apps"
            :key="app.name"
            :href="app.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="app-icon-wrap">
              <img
                v-if="!app.faviconFailed && faviconUrl(app.url)"
                class="app-favicon"
                :src="faviconUrl(app.url)"
                alt=""
                loading="lazy"
                draggable="false"
                width="22"
                height="22"
                @error="app.faviconFailed = true"
              />
              <span v-else class="app-fallback" aria-hidden="true">{{
                app.name.charAt(0).toUpperCase()
              }}</span>
            </span>
            <span class="app-name">{{ app.name }}</span>
          </a>
        </div>
      </div>


      <div class="card">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 11l3 3 8-8" />
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
          </svg>
          <span>Tasks</span>
          <span class="counter">{{ remainingTasks }}</span>
        </h2>
        <div class="task-list">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="task-item"
            :class="{ done: task.done }"
            @click="toggleTask(task)"
          >
            <span class="task-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span class="task-text">{{ task.text }}</span>
            <button
              class="task-remove"
              @click.stop="removeTask(task.id)"
              :aria-label="'Remove ' + task.text"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form class="task-add" @submit.prevent="submitTask">
          <input
            v-model="taskInput"
            type="text"
            placeholder="Add a task..."
            aria-label="New task"
          />
          <button type="submit" aria-label="Add task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </form>
      </div>

      <div class="card">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="14" y2="17" />
          </svg>
          Notes
        </h2>
        <p class="note-text">
          Welcome to Pulse New Tab. Add your favorite links, capture quick tasks, and jot notes — all in one quiet, themed dashboard.
        </p>
      </div>
    </section>
  </main>
</template>
