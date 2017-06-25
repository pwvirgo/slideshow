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
	static Gui gui = new Gui();
	
	public static void main(String[] args) {
		String dir = args[0];
		Images images = new Images(args[0]);
		gui.showSlides(images);
	}
}
