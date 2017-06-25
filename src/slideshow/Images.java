package slideshow;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.HashSet;
import java.util.Random;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.imageio.ImageIO;

/**
 *
 * @author pwv
 */
public class Images {
	static final Logger log = Logger.getLogger( "slideshow.Images" );
	private File [] imgFiles;
	private final int playlistSize = 5;
	private int [] playlist = new int[playlistSize];
	private int playlistNext = 0; // index of next slot in playlist
	private Random random = new Random();
	
  // the length of the playlist
	
	public Images(String directory) {
		getFiles(new File(directory));
		log.log(Level.INFO, "images: Found {0}image files in {1}",
						new Object[]{imgFiles.length, directory});
	}
	// need to set up timer loop see this:
	// http://www.javapractices.com/topic/TopicAction.do?Id=160
	
	
	/**
	 * populate the images array with all image files in a given directory
	 *		and any subdirectories
	 * @param dir the directory (or file)
	 */
	public final void getFiles(File dir) { getFiles2(dir, new HashSet<>(64)); }

	/**
	 *  populate the images array with all image files in a given directory
	 *		and any subdirectories using recursion.
	 *  (modified an example at
	 *	     https://stackoverflow.com/questions/2056221/recursively-list-files-in-java)
	 * @param dir the directory (or file)
	 */
	private void getFiles2(File dir, HashSet<File> tmp) {
		File[] children = dir.listFiles(); // all files in directory or a single file
		if (children !=null) for (File child : children) {
			if (isImage(child)) tmp.add(child);
			getFiles2(child, tmp);
		}
		imgFiles=tmp.toArray(new File [0]);
	}
	
	/**
	 * Create a BufferedImage from a file
	 * @param index the index of the file in ImgFiles
	 * @return the Buffered image
	 */
	public BufferedImage getImage(int index) {
		BufferedImage buf;
		File imgfile = imgFiles[index];
		try {  buf = ImageIO.read(imgfile); } 
		
		catch (IOException e) {
			log.log(Level.SEVERE, "images: error reading imageFile {0}",
							imgfile.getAbsolutePath());
			buf=null;
		}
		return buf; 
	}
	
	/**
	 * get a random image and save the index of the image in the next 
	 * slot in the playlist
	 * 
	 * side effect:  advances playlistNext to the next slot in playlist 
	 * @return the image
	 */
	public BufferedImage getRandomImage() {
		BufferedImage buf;
		int ndx = playlistNext;
		playlistNext = ++playlistNext % playlistSize;	
		playlist[ndx] = random.nextInt(imgFiles.length);
		return getImage(playlist[ndx]);
	}
	
	/**
	 * Is the file an image file?
	 * @param file
	 * @return true or false
	 */
	public static boolean isImage (File file) {
		return file.getName().toLowerCase().endsWith("jpg");
	}
}
