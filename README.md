# cloverslove

my personal site. a title-screen style menu over a looping video background, with sections for
about me, my github repos, socials and settings.

## what's in it

- **menu** you can move with the mouse wheel, arrow keys or W/S, and open with click or enter
- **about me** with live discord status and spotify (via [lanyard](https://github.com/Phineas/lanyard)),
  a birthday countdown, and a github contribution grid drawn from data
- **repos** pulled live from the github api; click one to see a summary of its readme
- **socials** and **settings** (music, menu sounds, moving background, less motion)
- menu sound effects are synthesized in the browser (`sfx.js`), no audio files needed

## run it

```bash
npm install
npm run dev
```

## media (not included)

the background video and music aren't mine to redistribute, so they're not in this repo.
the site still runs without them, just without a moving background or music.
to get the full thing, drop your own files in:

| file | used for |
| --- | --- |
| `public/assets/video/landscape.mp4` | background video |
| `public/assets/music/background.mp3` | background music |

optional: put your own sound effects in `public/assets/sfx/` (see the readme there) to replace
the built-in menu blips.
