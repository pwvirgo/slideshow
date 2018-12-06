# Slideshow app

This is a java desktop application for displaying a slideshow of image files.  A single parameter string of a file folder of images is required. All images in that folder and all sub-folders are randomly displayed.  T

The application window is resizable.

A user menu is invoked by clicking the mouse on the slideshow. From this menu user can pause, resume, return to previously displayed images,request information about the image (fileName and path), and exit the application.

# How to run the application
The application should be in "slideshow.jar" - if the jvm v1.8 or better is installed you can just use the command line like :
    java -jar "slideshow.jar" ~/a/photos/2004

The last parameter is the root directory of the photos you want included.

If the jvm is not installed ....... I should set this up for you, but that has not happened yet.


# Orientation for developer (me)
I am writing this in December of 2018 and trying to remember how this works....

according to the git log this was a project I (Phillip Virgo)  started in Jun 2017 and put aside after 10 days.  I works but is by no means complete nor bug free.  I think if it crashes you just try again and that usually works.



## To Do

### fix Bugs
**Null pointer errors in Gui2.java when accessing the playlist** which can happen when looking for previous slides, but which most often occurs at startup seems to be because of the swing timer events.

*solutions*
+ pre-populate all slots of the playlist

+ muck with the swing.Timer delays (setting constructor delay to 600000, then timer.setInitialDelay(1000), and then having the user reset it seems to solve the problem).

+  cancel and replace the timer with a new timer rather than start and resume.  (this may be important for moving through the playlist)

+  switch to util.timer

### General
+  full screen?
+  copy file path to clipboard
+  copy file path to notes.txt or db
+  support ratings and notes in a db
+  show warnings and errors to user

### Add startup customization
properties file and/or arguments
  + image directory and/or a file of directories and/or files
  + timer settings
  + frame size
  + control of log files and log levels

### Add menu options
  + change image file directory
  + exit application

### logging
  + save logs to file
  + save user notes to log file as makeshift notes db
  + centralize control of log levels

### learn to convert this file to pdf.

### done
+  center images  (centered horizontally 20170602)

## Classes
### Gui.java
Responsible for:
  + layout of the (user resizable) screen
  + scaling of images to fit the screen
  + displaying images
  + swapping new images to the display
  + displaying a popup menu (SlideMenu)

### Images.java
Responsible for:
  + deciding what files are images
  + getting images from storage
  + serving up random and/or specific images
  + keeping a private playlist of images which have been served enabling non-random retrieval of previous images.

Possible issues:
  + better response to io errors (currently just logs the error and returns a null object.)
  + One can only move backwards through the playlist, and as previous images are retrieved the current image(s) will be replaced with the next random image(s).

## SlideMenu
The popup menu for user options

## Slideshow
Main program responsible for:
    + runtime parameters (currently only the directory)

## Issues with this app



### Closing files
The files are not closed, and that may be a mistake, but  ImageIO has a `read()` but no `close()` method.

### Static - functional
I am unclear when I want to use static classes and methods.  It is easier for me to use classes and instances - so at the moment the code is inconsistent.

### MVC
I'd like to design this so that the user interface (Gui.java) is completely controlled from the main module (Slideshow.java). Slideshow would request a new image from Images.java and then request Gui to display it. Gui would pass requests from the users back to slideshow, which would then orchestrate.

This way the logic and presentation could be independent which would allow them to be moved to different implementations (eq swing or html or xxx for the Gui without changing the logic)

But it is easier to keep the user interaction controls right in the Gui -  Which I am doing as I write this.



## Issues with Java API !#$#@$!

### javax.swing.Timer with java.awt.event.ActionListener
I wasted a lot of hours to figure out a bug thanks to undocumented strange behavior.   The ActionListener fires according to the delay specified in the constructor `new Timer(int delay, Actionlistener listener)` even after you use `timer.setDelay(int d)` to a different value AND `logging` and or `System.out.println()` and other statements are executed at the initilized delay BUT `repaint()` only happens at times specified by `setDelay(int d)`.  So behavior unexpected behavior was hard to debug!



In the code below the images are swapped and log messages are sent at intervals that match either the original delay or the new delay value, but the repaint only occurs at intervals of the new delay value.

Even worse? - `timer.stop()` behaves the same way - only the repaint() is not executed.

    ActionListener timesUp = new ActionListener() {

        final Logger  log2 = Logger.getLogger( "slideshow.Gui2");

        @Override
        public void actionPerformed(ActionEvent evt) {  
            log2.info("timesUp!" );  
            image=images.getRandomImage();   
            repaint();
    }};

This is after a `timer.stop()` and `timer.resume()` which is the only way I have tested it.
