# Documentation of Slideshow app
This is a java desktop application for displaying a slideshow of image files.  A single parameter string of a file folder of images is required. All images in that folder and all sub-folders are randomly used displayed.  The user can pause, resume, return to previously displayed images, and request information about the image (fileName and path).
## Issues
### MVC
I'd like to design this so that the user interface (Gui.java) is completely controlled from the main module (Slideshow.java). Slideshow would request a new image from Images.java and then request Gui to display it. Gui would pass requests from the users back to slideshow, which would then orchestrate.

This way the logic and presentation could be independent which would allow them to be moved to different implementations (eq swing or html or xxx for the Gui without changing the logic)

But it is easier to keep the user interaction controls right in the Gui -  Which I am doing as I write this.

### Static - functional
I am unclear when I want to use static classes and methods.  It is easier for me to use classes and instances - so at the moment the code is inconsistent.

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

## SlideMenu
The popup menu for user options

## Slideshow
Main program responsible for:
    + runtime parameters (currently only the directory)
    
