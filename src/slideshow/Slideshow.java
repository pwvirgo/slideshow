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

	public static void main(String[] args) {
		String dir = args[0];
		Images images = new Images(args[0]);
		Gui.showSlides(images);
	}
}
