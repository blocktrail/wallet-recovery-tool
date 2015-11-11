var gulp = require('gulp');
var ngAnnotate = require('gulp-ng-annotate');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var notifier = require('node-notifier');

var isWatch = false;
var config = {
    minify: process.argv.indexOf('--minify') !== -1 || process.argv.indexOf('--uglify') !== -1
};

gulp.task('js:libs', function(done) {
        gulp.src([
            './src/libs/jquery/dist/jquery.min.js',
            './src/libs/angular/angular.js',
            './src/libs/angular-ui/ui-bootstrap-tpls.js',

            './src/libs/qrcode-decode-js/lib/qrcode-decodeer.js',
            './src/libs/html5-qrcode/lib/jsqrcode-combined.min.js',
            './src/libs/html5-qrcode/src/html5-qrcode.js',

            './src/libs/pdfjs-dist/build/pdf.combined.js',
        ])
            .pipe(concat('libs.js'))
            .pipe(gulpif(config.minify, uglify()))
            .pipe(gulp.dest('./build/js/'))
            .on('end', done);
});

gulp.task('js:node-config', function(done) {
    gulp.src([
        './src/js/nw-config.js',
    ])
        .pipe(concat('nw-config.js'))
        .pipe(ngAnnotate())
        .on('error', function(e) {
            if (isWatch) {
                notifier.notify({
                    title: 'GULP watch + js:node-config Error',
                    message: e.message
                });
                console.error(e);
                this.emit('end');
            } else {
                throw e;
            }
        })
        .pipe(gulpif(config.minify, uglify()))
        .pipe(gulp.dest('./build/js/'))
        .on('end', done);
});

gulp.task('js:app', function(done) {
    gulp.src([
        './src/js/**/*.js',
        '!./src/js/nw-config.js',
    ])
        .pipe(concat('app.js'))
        .pipe(ngAnnotate())
        .on('error', function(e) {
            if (isWatch) {
                notifier.notify({
                    title: 'GULP watch + js:app + ngAnnotate ERR',
                    message: e.message
                });
                console.error(e);
                this.emit('end');
            } else {
                throw e;
            }
        })
        .pipe(gulpif(config.minify, uglify()))
        .pipe(gulp.dest('./build/js/'))
        .on('end', done);
});

gulp.task('js:sdk', function(done) {
    gulp.src([
        "./src/libs/blocktrail-sdk-nodejs/build/blocktrail-sdk-full.js"
    ])
        .pipe(concat('sdk.js'))
        .pipe(gulpif(config.minify, uglify({
            mangle: {
                except: ['Buffer', 'BigInteger', 'Point', 'Script', 'ECPubKey', 'ECKey']
            }
        })))
        .pipe(gulp.dest('./build/js/'))
        .on('end', done);
});

gulp.task('sass', function(done) {
        gulp.src('./src/scss/**/*.scss')
            .pipe(sass({errLogToConsole: true}))
            .pipe(gulpif(config.minify, minifyCss({keepSpecialComments: 0})))
            .pipe(gulp.dest('./build/css/'))
            .on('end', done);
});

gulp.task('templates:index', function(done) {
    gulp.src("./src/index.html")
        .pipe(template({
            VERSION: "0.1"
        }))
        .pipe(gulp.dest("./build"))
        .on('end', done);
});

gulp.task('templates:rest', function(done) {
    gulp.src(["./src/templates/**/*"])
        .pipe(gulp.dest("./build/templates"))
        .on('end', done);
});

gulp.task('copyfonts', function(done) {
    gulp.src('./src/fonts/**/*.{ttf,woff,eof,eot,svg}')
        .pipe(gulp.dest('./build/fonts'))
        .on('end', done);
});


/*---Main tasks---*/
gulp.task('js', ['js:libs', 'js:app', 'js:sdk']);
gulp.task('templates', ['templates:index', 'templates:rest']);
gulp.task('default', ['sass', 'templates', 'js', 'copyfonts']);

/*---Watch tasks---*/
gulp.task('watch', function() {
    isWatch = true;

    gulp.watch(['./src/scss/**/*.scss'], ['sass']);
    gulp.watch(['./src/js/**/*.js'], ['js:app']);
    gulp.watch(['./src/lib/**/*.js'], ['js:libs', 'js:sdk']);
    gulp.watch(['./src/templates/**/*', './src/index.html'], ['templates']);
});
