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
public class Images2 {
	static final Logger			log = Logger.getLogger( "slideshow.Images" );
	private File []					imgFiles;
	private final int				playlistSize = 5;
	private final Fimage []	playlist = new Fimage[playlistSize];
	private int							currIndex = -1; // index of the current image in the playlist
	private Random					random = new Random();
	
  
	
	public Images2 (String directory) {
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
	public Fimage getImage(int index) {
		Fimage	fimage= new Fimage();
		File imgfile = imgFiles[index];
		try {  
			fimage.setImage(ImageIO.read(imgfile));
			fimage.setFile(imgfile);
		} 
		catch (Exception e) {
			log.severe(e.getMessage() + " " +
							imgfile.getAbsolutePath());
		}
		if (fimage == null) {
			log.severe("fimage is null \n");
		}  else log.info("No problem!" + fimage.getFile() + "\n");
		
		return fimage; 
	}
	
	public Fimage getPriorImage() {
		log.finer("                             playlist: " + showplaylist() +
						" currIndex: " + currIndex);  
		
		if (currIndex == 0) {
			if (playlist[playlistSize - 1] != null) 
				currIndex = playlistSize -1; // wrap to end of list
			else log.warning("                    Prior image is null - NOT MOVING!");
		}
		
		else if (playlist[currIndex -1] != null) 
			currIndex = --currIndex;
		
		log.finer("                             RESET to: " + showplaylist() +
						" currIndex: " + currIndex);  
		return playlist[currIndex];
	}
	
	String showplaylist() {
		StringBuilder s = new StringBuilder(11);
		for (int j=0; j< playlistSize; j++) {
			s.append(" [" + j + "]: " + playlist[j]);
		}
		return s.toString();
	}
	/**
	 * get a random image and save the index of the image in the next 
	 * slot in the playlist
	 * 
	 * side effect:  advances playlistNext to the next slot in playlist 
	 * @return the image
	 */
	public Fimage getRandomImage() {
		int rand = random.nextInt(imgFiles.length); 
		log.info("BEFORE getImage() " + showplaylist()+ " currIndex: " + currIndex + "\n");
		currIndex = ++currIndex % playlistSize;	
		playlist[currIndex] = getImage(random.nextInt(rand));
		
		log.info("AFTER getImage() " + showplaylist()+ " currIndex: " + currIndex + "\n");
		
		if (playlist[currIndex] == null ) {
			log.severe("Playlist[currIndex] is null! igmFiles.length: " + imgFiles.length 
				+ "  rand: "  + rand );
		} else if (playlist[currIndex].getFile() == null) {
			log.severe("Playlist[currIndex].getfile() is null ! "
				+ "igmFiles.length: " + imgFiles.length 
				+ "  rand: "  + rand );
		}
		return playlist[currIndex];
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

