# Sidebar Integration Guide

Complete guide to integrating the ChatSidebar component into ImageChat and implementing the sidebar-based UX.

---

## Overview

The `ChatSidebar` component provides:
- **Collapsible Navigation** - Hamburger menu on mobile, fixed sidebar on desktop
- **Generation Settings** - Image size, model selection, quality toggle
- **Chat History** - List of previous conversations with quick access
- **Credits Display** - Real-time credit balance
- **Responsive Design** - Touch-friendly buttons (min 44px), smooth animations with Framer Motion

---

## Component Structure

### ChatSidebar Props

```typescript
interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  settings: GenerationSettings;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onSettingsChange: (settings: GenerationSettings) => void;
  credits: number | null;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}

interface GenerationSettings {
  imageSize: "512x512" | "768x768" | "1024x1024" | "1024x576" | "576x1024";
  model: "replicate-flux" | "gemini-2.5-flash-image" | "gemini-3.1-flash-image-preview";
  quality: "standard" | "hd";
}
```

---

## Features

### 1. Mobile Responsive Design

**Desktop (≥768px):**
- Fixed sidebar on left (256px width)
- Main content takes remaining space
- No hamburger menu

**Mobile (<768px):**
- Hamburger menu button (fixed top-left)
- Sidebar slides in from left with overlay
- Closes when item selected or overlay clicked

### 2. Generation Settings Panel

Collapsible section with:
- **Image Size** - Dropdown with 5 preset sizes
- **Model Selection** - 3 model options
- **Quality Toggle** - Standard vs HD buttons

Smooth expand/collapse animation using Framer Motion.

### 3. Chat History

- Scrollable list of previous sessions
- Shows message count per session
- Hover to reveal delete button
- Click to switch sessions
- Highlights current session

### 4. Credits Display

- Prominent card showing available credits
- Updates in real-time
- Only shown when user is authenticated

### 5. Animations

Uses Framer Motion for smooth transitions:
- Sidebar slide-in/out (spring animation)
- Overlay fade
- Settings expand/collapse
- Chat history item fade-in

---

## Integration Steps

### Step 1: Install Dependencies

```bash
npm install framer-motion
```

### Step 2: Add State to ImageChat

```typescript
const [chatSessions, setChatSessions] = useState<Array<{
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}>>([]);

const [generationSettings, setGenerationSettings] = useState({
  imageSize: "1024x1024" as const,
  model: "gemini-3.1-flash-image-preview" as const,
  quality: "standard" as const,
});
```

### Step 3: Wrap Layout with Sidebar

```typescript
export function ImageChat({ inline = false, ... }: ImageChatProps) {
  // ... existing state and functions ...

  if (inline) {
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <ChatSidebar
          sessions={chatSessions}
          currentSessionId={sessionId}
          settings={generationSettings}
          onNewChat={() => {
            setSessionId(null);
            setMessagesMap(new Map());
            setPrompt("");
          }}
          onSelectSession={(id) => {
            setSessionId(id);
            // Load messages for this session
          }}
          onDeleteSession={(id) => {
            setChatSessions(prev => prev.filter(s => s.id !== id));
            if (sessionId === id) {
              setSessionId(null);
              setMessagesMap(new Map());
            }
          }}
          onSettingsChange={setGenerationSettings}
          credits={credits}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Existing chat UI */}
          {renderChatContent()}
        </div>
      </div>
    );
  }

  // Non-inline mode (floating sheet) remains unchanged
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* ... existing sheet content ... */}
    </Sheet>
  );
}
```

### Step 4: Update Session Management

Add functions to manage chat sessions:

```typescript
// Create new session
const createSession = (title: string) => {
  const session = {
    id: uuid(),
    title,
    timestamp: new Date(),
    messageCount: 0,
  };
  setChatSessions(prev => [session, ...prev]);
  setSessionId(session.id);
};

// Update session message count
useEffect(() => {
  if (sessionId) {
    setChatSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messageCount: messages.length }
          : s
      )
    );
  }
}, [messages.length, sessionId]);

// Load session messages
const loadSession = async (id: string) => {
  try {
    const messages = await listMessages(token, id);
    setMessagesMap(new Map(messages.map(m => [m.id, m])));
  } catch (error) {
    console.error("Failed to load session:", error);
  }
};
```

### Step 5: Update Generation with Settings

Modify generation to use sidebar settings:

```typescript
const handleGenerateWithPrompt = async (customPrompt?: string) => {
  // ... existing code ...
  
  const res = await generateImage(token ?? null, {
    prompt: promptToUse,
    session_id: sessionId ?? undefined,
    image_base64: imageBase64 ?? undefined,
    model: generationSettings.model,
    // Add size and quality parameters if supported by API
  });
  
  // ... rest of generation logic ...
};
```

---

## Styling & Tailwind Classes

### Responsive Breakpoints

- `md:` - 768px and up (desktop)
- `sm:` - 640px and up (tablet)
- Mobile-first approach

### Key Classes

- `fixed md:relative` - Sidebar positioning
- `h-screen` - Full viewport height
- `flex h-screen` - Main layout container
- `flex-1` - Main content takes remaining space
- `overflow-hidden` - Prevent scrollbars on container
- `min-h-0` - Allow flex children to shrink below content size

### Touch-Friendly Sizing

- Buttons: `h-10 w-10` (40px minimum)
- Clickable areas: `px-3 py-2` (minimum 44px height)
- Spacing: `gap-2`, `gap-3` for comfortable touch targets

---

## Animation Details

### Sidebar Slide

```typescript
<motion.aside
  initial={false}
  animate={{
    x: isOpen ? 0 : "-100%",
  }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
>
```

- Spring animation for natural feel
- Smooth deceleration
- Respects `initial={false}` to skip initial animation

### Settings Expand

```typescript
<motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: "auto" }}
  exit={{ opacity: 0, height: 0 }}
>
```

- Smooth height transition
- Fade in/out for visual polish

### Chat History Items

```typescript
<motion.div
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -10 }}
>
```

- Slide in from left
- Fade in simultaneously

---

## Accessibility Features

- Semantic HTML (`<aside>`, `<nav>`)
- ARIA labels on buttons
- Keyboard navigation support (Escape to close sidebar)
- Touch-friendly button sizes
- High contrast for visibility
- Proper heading hierarchy

---

## Performance Optimizations

1. **Memoization** - Use `React.memo` for chat history items
2. **Lazy Loading** - Load chat sessions on demand
3. **Virtualization** - Consider for large chat history lists
4. **Debouncing** - Debounce settings changes if needed

---

## Testing Checklist

- [ ] Sidebar opens/closes on mobile
- [ ] Settings persist across sessions
- [ ] Chat history loads correctly
- [ ] Session switching works
- [ ] Delete session removes from list
- [ ] Credits update in real-time
- [ ] Responsive on all breakpoints
- [ ] Touch targets are 44px minimum
- [ ] Animations are smooth
- [ ] Keyboard navigation works

---

## Future Enhancements

1. **Search** - Search chat history
2. **Favorites** - Star/favorite sessions
3. **Export** - Export chat as PDF/JSON
4. **Sync** - Cloud sync for sessions
5. **Themes** - Theme selector in sidebar
6. **Keyboard Shortcuts** - Cmd+K for search, etc.
7. **Session Grouping** - Group by date/tag
8. **Collaborative** - Share sessions with others

---

## Troubleshooting

### Sidebar Not Appearing

- Check `inline={true}` is passed to ImageChat
- Verify `framer-motion` is installed
- Check console for errors

### Settings Not Persisting

- Ensure `onSettingsChange` is connected to state
- Verify state updates are triggering re-renders
- Check localStorage integration if needed

### Mobile Menu Not Working

- Verify hamburger button is visible on mobile
- Check `md:` breakpoint is correct
- Test on actual mobile device (not just responsive view)

### Animations Stuttering

- Check for expensive re-renders
- Profile with React DevTools
- Consider reducing animation complexity

---

## Code Examples

### Complete Integration Example

```typescript
import { ChatSidebar } from "@/components/ChatSidebar";

export function ImageChat({ inline = false, ... }: ImageChatProps) {
  const [chatSessions, setChatSessions] = useState([]);
  const [generationSettings, setGenerationSettings] = useState({
    imageSize: "1024x1024",
    model: "gemini-3.1-flash-image-preview",
    quality: "standard",
  });

  if (inline) {
    return (
      <div className="flex h-screen bg-background">
        <ChatSidebar
          sessions={chatSessions}
          currentSessionId={sessionId}
          settings={generationSettings}
          onNewChat={() => {
            setSessionId(null);
            setMessagesMap(new Map());
          }}
          onSelectSession={loadSession}
          onDeleteSession={(id) => {
            setChatSessions(prev => prev.filter(s => s.id !== id));
          }}
          onSettingsChange={setGenerationSettings}
          credits={credits}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderChatContent()}
        </div>
      </div>
    );
  }

  return <Sheet>{/* floating mode */}</Sheet>;
}
```

---

## Dependencies

- `framer-motion` - Animations
- `lucide-react` - Icons
- `tailwindcss` - Styling
- `@radix-ui/react-scroll-area` - Scrollable history
- React 18+

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

All modern browsers with CSS Grid, Flexbox, and CSS Variables support.
