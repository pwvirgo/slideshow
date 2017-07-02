package slideshow;

import java.io.File;
import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 *
 * @author pwv
 */

public class Slideshow {
	static final Logger log = Logger.getLogger( "slideshow.SlideShow" );
	static Gui2					gui = new Gui2();
	
	public static void main(String[] args) {
		String dir = args[0];
		Images2 images = new Images2(args[0]);
		gui.showSlides(images);
	}
}
