package slideshow;

import java.io.File;
import java.io.IOException;
import java.util.logging.FileHandler;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.logging.SimpleFormatter;
import java.util.logging.StreamHandler;

/**
 *
 * @author pwv
 */

public class Slideshow {
	static final Logger log = Logger.getLogger( "slideshow" );
	
	static Gui2					gui = new Gui2();
	
	public static void main(String[] args) {	
		String logfile = "slideshow.log";
    try {  

        // This block configure the logger with handler and formatter  
        FileHandler fh = new FileHandler(logfile);  
        log.addHandler(fh);
        fh.setFormatter(new SimpleFormatter());  

        // the following statement is used to log any messages  
        log.info("Runtime information - you can delete this file\n\n");  

    } catch (Exception e) {
			  System.err.println("\n\n" + e.getMessage() 
					+ "\n while trying to set up runtime log: " + logfile);
        e.printStackTrace();  
    }
		log.addHandler(new StreamHandler(System.out, new SimpleFormatter()));
		
		if (! (args.length > 0)) {
			log.severe("\n\nError! You must supply a valid directory! such as: \n" +
							"java -jar \"slideshow.jar\" ~/a/photos/2004\n\n");
			System.exit(73);
			
		} else {
			String dir = args[0];
			Images2 images = new Images2(args[0]);
			gui.showSlides(images);
		}
	}
}
