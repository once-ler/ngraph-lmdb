var gulp = require('gulp');
var clean = require('gulp-clean');
var prettify = require('gulp-jsbeautifier');

gulp.task('git-pre-js', function() {
  gulp.src(['./lib/**/*.js','./test/**/*.js'])
    .pipe(prettify({config: '.jsbeautifyrc', mode: 'VERIFY_ONLY'}))
});

gulp.task('clean', function() {
  gulp.src('./dist', {read: false})
    .pipe(clean());
});

gulp.task('lib', function() {
  gulp.src(['./lib/*.js'])
.pipe(prettify({config: '.jsbeautifyrc', mode: 'VERIFY_AND_WRITE'}))
    .pipe(gulp.dest('./lib'))
});

gulp.task('test', function() {
  gulp.src(['./test/**/*.js'])
.pipe(prettify({config: '.jsbeautifyrc', mode: 'VERIFY_AND_WRITE'}))
    .pipe(gulp.dest('./test'))
});

gulp.task('archive', function() {
  gulp.src(['./archive/*.js'])
.pipe(prettify({config: '.jsbeautifyrc', mode: 'VERIFY_AND_WRITE'}))
    .pipe(gulp.dest('./archive'))
});

gulp.task('tests', function() {
  gulp.src(['./tests/**/*.js'])
.pipe(prettify({config: '.jsbeautifyrc', mode: 'VERIFY_AND_WRITE'}))
    .pipe(gulp.dest('./tests'))
});

gulp.task('dist',['lib','test']);

gulp.task('default',['lib','test','archive','tests']);