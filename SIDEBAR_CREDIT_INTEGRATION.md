# Sidebar & Credit UI Integration Guide

Complete step-by-step guide to integrate ChatSidebar and credit UI components into ImageChat.

---

## Components Ready for Integration

✅ **ChatSidebar** - Collapsible navigation with settings and chat history
✅ **CreditBadge** - Persistent credit balance display with quick-view dropdown
✅ **GenerationCostLabel** - Cost labels for generation buttons
✅ **GenerationRecapToast** - Success feedback after generation
✅ **TransactionHistory** - Transaction log for sidebar

All imports are already added to `ImageChat.tsx`.

---

## Integration Steps

### Step 1: Add State for Sidebar Features

In `ImageChat.tsx`, add these state variables after the existing state declarations (around line 251):

```typescript
// Chat sessions for sidebar
const [chatSessions, setChatSessions] = useState<Array<{
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}>>([]);

// Credit history for transaction log
const [creditHistory, setCreditHistory] = useState<any[]>([]);

// Generation settings
const [generationSettings, setGenerationSettings] = useState({
  imageSize: "1024x1024" as const,
  model: "gemini-3.1-flash-image-preview" as const,
  quality: "standard" as const,
});

// Recap toast state
const [showRecapToast, setShowRecapToast] = useState(false);
const [recapData, setRecapData] = useState({
  cost: 0,
  remaining: 0,
  type: "standard" as const,
});
```

### Step 2: Replace CreditDisplay with CreditBadge in Header

**Location:** Around line 1372 in the inline mode header

**Find:**
```typescript
{user && <CreditDisplay compact={true} />}
```

**Replace with:**
```typescript
<CreditBadge
  balance={credits}
  isLow={credits !== null && credits < 2}
/>
```

Also do this in the fullscreen header (around line 1417).

### Step 3: Add GenerationCostLabel to Generate Button

**Location:** Find the main "Generate" button in `renderChatContent()` function

**Find:**
```typescript
<Button
  onClick={handleGenerate}
  disabled={...}
  className="..."
>
  Generate
</Button>
```

**Replace with:**
```typescript
<Button
  onClick={handleGenerate}
  disabled={credits === null || credits < 1 || ...}
  className="gap-2"
>
  Generate
  <GenerationCostLabel cost={1} userBalance={credits} />
</Button>
```

### Step 4: Show Recap Toast After Generation

**Location:** In `handleGenerateWithPrompt()` function, after successful generation (around line 710)

**Find:**
```typescript
setCredits(res.credits_remaining);
```

**Add after:**
```typescript
// Show recap toast
setRecapData({
  cost: 1, // or 2/3 depending on generation type
  remaining: res.credits_remaining,
  type: "standard", // or "hd"/"batch"
});
setShowRecapToast(true);
```

### Step 5: Add Recap Toast to Render

**Location:** At the end of the return statement in inline mode (before closing `</>`)

**Add:**
```typescript
<GenerationRecapToast
  isVisible={showRecapToast}
  creditsCost={recapData.cost}
  creditsRemaining={recapData.remaining}
  generationType={recapData.type}
  onClose={() => setShowRecapToast(false)}
/>
```

### Step 6: Add Sidebar (Optional - Full Layout Restructure)

For a complete sidebar integration with the layout restructure, wrap the inline mode content:

**Location:** At the start of inline mode return (line 1354)

**Replace:**
```typescript
if (inline) {
  return (
    <>
```

**With:**
```typescript
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
        onSelectSession={(id) => setSessionId(id)}
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
        <>
```

**And at the end, replace:**
```typescript
    </>
  );
}
```

**With:**
```typescript
        </>
      </div>
    </div>
  );
}
```

---

## Quick Integration Checklist

- [ ] Add state variables for sidebar features
- [ ] Replace CreditDisplay with CreditBadge in header
- [ ] Add GenerationCostLabel to Generate button
- [ ] Disable button if `credits < cost`
- [ ] Show recap toast after generation
- [ ] Add recap toast to render
- [ ] (Optional) Add full sidebar layout

---

## Testing Checklist

After integration, test:

- [ ] CreditBadge displays correct balance
- [ ] CreditBadge dropdown shows earning methods
- [ ] GenerationCostLabel shows correct cost
- [ ] Button disables when insufficient credits
- [ ] Recap toast shows after generation
- [ ] Recap toast auto-closes after 6 seconds
- [ ] Recap toast shows "Earn Credits" CTA when low
- [ ] Sidebar opens/closes on mobile
- [ ] Sidebar settings persist
- [ ] Chat history loads in sidebar

---

## Component Props Reference

### CreditBadge
```typescript
<CreditBadge
  balance={credits}                    // Current credit balance
  onEarnClick={() => {}}              // Optional: handle earn click
  isLow={credits < 2}                 // Optional: highlight if low
/>
```

### GenerationCostLabel
```typescript
<GenerationCostLabel
  cost={1}                            // Cost in credits
  userBalance={credits}               // User's current balance
  disabled={credits < 1}              // Optional: disable state
/>
```

### GenerationRecapToast
```typescript
<GenerationRecapToast
  isVisible={showRecapToast}           // Show/hide toast
  creditsCost={1}                      // Cost of generation
  creditsRemaining={9}                 // Remaining balance
  generationType="standard"            // "standard" | "hd" | "batch"
  onClose={() => {}}                   // Close handler
  onEarnClick={() => {}}               // Optional: earn click handler
/>
```

### ChatSidebar
```typescript
<ChatSidebar
  sessions={chatSessions}              // Array of chat sessions
  currentSessionId={sessionId}         // Currently active session
  settings={generationSettings}        // Generation settings
  onNewChat={() => {}}                 // New chat handler
  onSelectSession={(id) => {}}         // Select session handler
  onDeleteSession={(id) => {}}         // Delete session handler
  onSettingsChange={(settings) => {}}  // Settings change handler
  credits={credits}                    // Current credit balance
/>
```

### TransactionHistory
```typescript
<TransactionHistory
  transactions={creditHistory}         // Array of transactions
  isLoading={false}                    // Optional: loading state
/>
```

---

## Common Issues & Solutions

### Issue: CreditBadge not showing
**Solution:** Ensure `credits` state is initialized and updated from API

### Issue: GenerationCostLabel not disabling button
**Solution:** Check button's `disabled` prop includes credit check:
```typescript
disabled={credits === null || credits < cost || ...otherConditions}
```

### Issue: Recap toast not showing
**Solution:** Ensure `setShowRecapToast(true)` is called after generation success

### Issue: Sidebar not appearing
**Solution:** Ensure `inline={true}` is passed to ImageChat component

### Issue: Type errors with generationSettings
**Solution:** Use `as const` for literal types:
```typescript
imageSize: "1024x1024" as const,
model: "gemini-3.1-flash-image-preview" as const,
quality: "standard" as const,
```

---

## Files Modified

- `src/components/ImageChat.tsx` - Add state, integrate components
- Components created (no modifications needed):
  - `src/components/ChatSidebar.tsx`
  - `src/components/CreditBadge.tsx`
  - `src/components/GenerationCostLabel.tsx`
  - `src/components/GenerationRecapToast.tsx`
  - `src/components/TransactionHistory.tsx`

---

## Next Steps After Integration

1. **Load credit history** - Fetch from API and populate `creditHistory` state
2. **Load chat sessions** - Fetch from API and populate `chatSessions` state
3. **Update generation costs** - Adjust cost based on `generationSettings.quality`
4. **Connect earning methods** - Wire up daily login, share, and community engagement
5. **Add transaction logging** - Log each generation and earning action
6. **Test end-to-end** - Verify full credit flow from generation to recap

---

## API Integration Points

### After Generation Success
```typescript
// Deduct credits
const success = await deductCredits(token, 1, "spend_standard");

// Update local state
if (success) {
  setCredits(newBalance);
  setRecapData({
    cost: 1,
    remaining: newBalance,
    type: "standard",
  });
  setShowRecapToast(true);
}
```

### Load Credit History
```typescript
const history = await getCreditHistory(token);
setCreditHistory(history);
```

### Claim Daily Login
```typescript
const result = await claimDailyLogin(token);
if (result.success) {
  setCredits(result.credits);
}
```

---

## Performance Considerations

- **Memoize** CreditBadge and GenerationCostLabel to prevent re-renders
- **Lazy load** TransactionHistory in sidebar
- **Debounce** settings changes if needed
- **Cache** credit history to reduce API calls

---

## Accessibility

- CreditBadge: Keyboard accessible dropdown
- GenerationCostLabel: Screen reader friendly
- GenerationRecapToast: ARIA live region for announcements
- ChatSidebar: Keyboard navigation support
- All buttons: Min 44px touch targets

---

## Browser Support

All components use modern CSS and React features:
- React 18+
- CSS Grid/Flexbox
- CSS Variables
- Framer Motion animations

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)
