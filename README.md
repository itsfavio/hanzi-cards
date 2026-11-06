# Hanzi Cards 字卡

Mandarin flashcards for studying a class's vocab chapter by chapter. Each card has three sides: the character, the pinyin, and the meaning. You can hear the pronunciation of each word and watch (or trace) its stroke order.

It's a plain static site with no build step, no backend, and no accounts. Open it and start studying.

**Live site:** `https://itsfavio.github.io/hanzi-cards/`

## Features

- **Chapters.** Make one per lesson. They stay saved, so you don't have to re-enter words.
- **3-sided cards.** Character → pinyin → meaning. Tap the card to turn it. Use **Focus on** to pick which side each card starts on, for example to drill meaning → character.
- **Tone colors.** Each pinyin syllable is colored by its tone, so you start remembering words by their tone pattern.
- **Pronunciation.** Plays the word in a Mandarin voice, with a slow mode for hearing tones clearly.
- **Stroke order.** Animated stroke order on a 米字格 practice grid, plus a Practice mode where you trace each stroke and get a hint after two misses.
- **Simplified or traditional.** Chosen on first visit, switchable any time with the 简 / 繁 toggle.
- **Built-in dictionary.** Type characters or pinyin and the pinyin and meanings fill in automatically from CC-CEDICT (about 120k words).
- **Add from a photo.** Snap or upload a picture of a vocab list or textbook page and the app reads the characters off it — right in your browser — and drops them in the box, ready to look up.
- **Paste an image.** Copy a screenshot or picture of characters and paste it with Ctrl/⌘ + V (or long-press → Paste on a phone) on the Add words tab or Quick search. It's read the same way as a photo.
- **Quick search.** Look up any character, word or pinyin to see its readings, meanings and a character-by-character breakdown, without adding it to a chapter.
- **Quick write.** Type a character, word or pinyin to watch its stroke order and practice tracing it, with its pinyin and meaning, without adding it to a chapter.
- **Spaced repetition.** Grade each card **Don't know it**, **Still learning** or **I know it**. Missed cards come back later in the same session, and each "I know it" spaces the next review further out (1, 3, 7, then 14 days). A card is only Known, and stops showing, after you recall it at every step.
- **Active recall.** Stroke order stays hidden while you study. Tick **Show stroke order** to keep it open, or press **Peek strokes** on a card you're stuck on.

## How to use it

1. **Pick your character set.** On first visit, choose simplified (学习) or traditional (學習). Change it later with the 简 / 繁 toggle above the chapter list.
2. **Make a chapter.** Type a name, like `Lesson 3` or `第三课`, in the box under the chapter list and press **+**.
3. **Add words.** On the **Add words** tab, enter one entry per line and press **Look up** (or Ctrl/⌘ + Enter):

   ```
   你好                     characters on their own
   谢谢 老师 学生            several words on one line
   朋友 péngyou friend      characters + pinyin + your own meaning
   zaijian                  pinyin search, then pick the word
   ni3 hao3                 tone numbers work too
   ```

   Or press **From a photo** and pick (or snap) a picture of your vocab list. The app reads the characters off it and puts them in the box for you to check and look up. You can also copy an image and paste it straight in: Ctrl/⌘ + V on a computer, or long-press the box and tap **Paste** on a phone.

   Everything shows up for review first. You can switch readings for characters with more than one (行 xíng / háng), edit meanings, or remove entries. Then press **Add**. Words already in the chapter are skipped.
4. **Study.** On the **Study** tab you get today's reviews plus any new cards (**Due**). Switch to **All** for extra practice; reviewing a card early doesn't move its schedule. Tap the card to turn it and **Hear it** for pronunciation, then grade yourself:

   | Button | What happens |
   | --- | --- |
   | **Don't know it** | Starts the card's reviews over. It comes back after about 3 cards and needs "I know it" twice before it leaves the session. |
   | **Still learning** | Moves the card one step back. It comes back after about 5 cards. |
   | **I know it** | Schedules the next review: tomorrow, then 3, 7 and 14 days later. Recalling it once more after the 14-day gap makes it **Known**, and it stops showing. |

   Stroke order is hidden so you practice recalling the character first. Tick **Show stroke order** to keep it open, or press **Peek strokes** for just the current card.
5. **Manage.** The **Words** tab lists the whole chapter. Fix a pinyin or meaning inline, change a card's status, or delete cards.

### Keyboard shortcuts (Study tab)

| Key | Action |
| --- | --- |
| `Space` | Turn the card |
| `←` `→` | Previous / next card |
| `S` | Speak the word |
| `1` `2` `3` | Jump to character / pinyin / meaning |

### Tone colors

| Tone | Mark | Color | Example |
| --- | --- | --- | --- |
| 1 | ˉ high, flat | red | mā |
| 2 | ˊ rising | green | má |
| 3 | ˇ dipping | blue | mǎ |
| 4 | ˋ falling | purple | mà |
| 5 | · neutral | gray | ma |

## Notes

- **Where your cards are saved:** in your browser (localStorage). They stay put between visits on the same device and browser. Clearing site data, or switching to another device or browser, starts you fresh.
- **No sound?** Pronunciation uses your device's built-in text-to-speech, so a Chinese voice needs to be installed.
  - iPhone / Mac: Settings → Accessibility → Spoken Content → Voices → Chinese
  - Windows: Settings → Time & Language → Speech → Add voices → Chinese
  - Android: usually included. Otherwise check Settings → Text-to-speech.
- **First dictionary load:** the dictionary is about 9 MB and only loads the first time you open **Add words**. Studying doesn't need it.
- **Reading photos:** the first time you read an image (**From a photo** or paste), the app downloads a character-recognition model ([PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv6, about 55 MB) from this site and runs it on your device in a background worker. After that the browser keeps it. The image never leaves your device, and there's no server or AI service involved. It reads simplified and traditional characters, and copes with screenshots, photos of printed pages and neat handwriting, but always check what it read before looking up.

## Hosting it yourself

### GitHub Pages
1. Fork or copy this repo. It must be public on a free GitHub plan.
2. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then branch `main`, folder `/ (root)`, and **Save**.
3. After about a minute it's live at `https://<username>.github.io/<repo>/`.

### Locally
```sh
python3 -m http.server 8000
# open http://localhost:8000
```
Opening `index.html` directly as a file won't work, because browsers block the dictionary fetch from `file://`.

## Project structure

```
index.html              the whole app (HTML, CSS, JS in one file)
data/dict.tsv           trimmed CC-CEDICT: simplified, traditional, pinyin, meaning, frequency
data/strokes/sNN.json   stroke data for ~9,500 characters, split by code point and loaded on demand
data/ocr/*.tar          PP-OCRv6 small text detection + recognition models (ONNX)
vendor/ocr/             on-device OCR worker: PaddleOCR.js + OpenCV.js + ONNX Runtime Web, bundled
scripts/build_data.py   regenerates data/dict.tsv and data/strokes/
scripts/build_ocr.sh    rebuilds vendor/ocr/ and fetches data/ocr/ (sources and pinned versions in scripts/ocr/)
```

The Hanzi Writer library loads from the jsDelivr CDN. Everything else is served from this repo.

### Rebuilding the data
To pull a newer CC-CEDICT or new stroke data:
```sh
npm install hanzi hanzi-writer-data
python3 scripts/build_data.py
```
The script rewrites `data/` and updates the stroke-chunk index inside `index.html`.

### Rebuilding the OCR
To update PaddleOCR.js or change the worker (`scripts/ocr/worker.js`):
```sh
sh scripts/build_ocr.sh
```
It installs the versions pinned in `scripts/ocr/package.json`, bundles the worker into `vendor/ocr/`, and downloads the models into `data/ocr/` if they're missing. The models are kept in this repo because the official download host doesn't allow cross-site requests.

## Credits

- **[CC-CEDICT](https://cc-cedict.org/):** dictionary data, © MDBG, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). `data/dict.tsv` is a trimmed derivative and is shared under the same license.
- **[Hanzi Writer](https://hanziwriter.org/):** stroke animation and tracing (MIT).
- **[PaddleOCR / PaddleOCR.js](https://github.com/PaddlePaddle/PaddleOCR):** on-device character recognition and the PP-OCRv6 models (Apache-2.0), with [ONNX Runtime Web](https://onnxruntime.ai/) (MIT), [OpenCV.js](https://github.com/TechStark/opencv-js) (Apache-2.0) and [Clipper](https://www.npmjs.com/package/clipper-lib) (Boost).
- **[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) / [Make Me a Hanzi](https://github.com/skishore/makemeahanzi):** stroke data, derived from Arphic fonts under the [Arphic Public License](data/strokes/ARPHICPL.TXT).
- Word frequencies are from the Leiden Weibo Corpus and Jun Da's character frequency list, via the [`hanzi`](https://www.npmjs.com/package/hanzi) package.
