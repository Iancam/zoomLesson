# Zoom Lesson

![](hero.jpg)

Quickly grab the duration of your last couple zoom meetings so that you can bill your students accurately.

For (cs) tutors with a [pro zoom account](https://zoom.us/billing/plan?code=yearly_c50) and a [jwt app](https://marketplace.zoom.us/docs/guides/build/jwt-app).

Install with:

`yarn global add zoomlesson`

The first time you use the app, you should be prompted for your credentials. You can find those in your jwt app.

## Usage

`zmlssn list <student's name>`

Only want the last 5 lessons?
`zmlssn list <student's name> 5`

want the last unbilled lessons?
`zmlssn bill <student's name>`
(This will also prompt you to mark the shown lessons as billed)

# Features

Remembers the lessons that you've billed so you don't have to.

Gives you lesson duration down to the minute.

## Acknowledgments

This uses the [promise-ratelimit](https://www.npmjs.com/package/promise-ratelimit) library, which saved me quite a headache.

_Photo by <a href="https://unsplash.com/@dylanferreira?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Dylan Ferreira</a> on <a href="https://unsplash.com/s/photos/zoom?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>_
