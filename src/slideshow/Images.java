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
	private int [] playList;
	private int PLAYLIST_LEN = 5;  // the length of the playlist
	
	public Images(String directory) {
		getFiles(new File(directory));
		log.log(Level.INFO, "images: Found {0}image files in {1}",
						new Object[]{imgFiles.length, directory});
		playList = getPlayList(imgFiles.length, PLAYLIST_LEN);
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
			if (child.getName().toLowerCase().endsWith("jpg"))
				tmp.add(child);
			getFiles2(child, tmp);
		}
		imgFiles=tmp.toArray(new File [0]);
	}
	
		/**
	 * Create a Buffered image from a file
	 * @return the Buffered image
	 */
	public BufferedImage getImage() {

		BufferedImage buf;
		File imgfile = imgFiles[playList[2]];
		
		try {  buf = ImageIO.read(imgfile); } 
		
		catch (IOException e) {
			log.log(Level.SEVERE, "images: error reading imageFile {0}",
							imgfile.getAbsolutePath());
			buf=null;
		}
		return buf; 
	}
	
	public static int [] getPlayList(int maxImg, int playlen) {
		Random rand = new Random();
		int [] ret = new int[playlen];
		for (int j = 0; j <  playlen; j++){
      ret[j] = rand.nextInt(maxImg);
    }
		return ret;
	}
}
