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

## media

| file | used for |
| --- | --- |
| `public/assets/video/landscape.mp4` | background video (genshin impact landscape, © HoYoverse) |
| `public/assets/music/background.mp3` | background music (sabbath, from the saya no uta ost) |

neither is mine; they're here for a non-commercial personal site and belong to their owners.
swap in your own files with the same names to change them.

optional: put your own sound effects in `public/assets/sfx/` (see the readme there) to replace
the built-in menu blips.
