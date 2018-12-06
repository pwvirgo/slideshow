package slideshow;

import javax.swing.*; 
import java.awt.*; 
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.image.BufferedImage; 
import java.util.logging.Level;
import java.util.logging.Logger;

// https://docs.oracle.com/javase/tutorial/2d/images/drawimage.html

public class Gui2 extends JPanel implements MouseListener
{
  private static Fimage					fimage;  // image being displayed
  private static final JFrame		frame = new JFrame("Slipin an slidin");
	private static Images2				images;
	static final Logger						log = Logger.getLogger( "slideshow.Gui");
	private final SlideMenu				slideMenu = new SlideMenu(this);
	protected Timer								timer1;  // timer for changing images

	// potential user configurations
	protected int									delay = 600000; // image display duration for in milliseconds 
	
  public Gui2 () { 
		super();
		addMouseListener(this);
		add(slideMenu);
		// swing timer is bizarre!  KEEP TIMER DELAY HIGH IN CONSTRUCTOR
		// images keep changing at this constructor delay times even after the delay
		// has been reset and even when the timer is stopped!  
		timer1	= new Timer(6000000, timesUp);
		timer1.setInitialDelay(1000);
		timer1.setDelay(delay);
		
		timer1.start();
	}
	
	@Override public void mouseClicked(MouseEvent e) {
		//slideMenu.setVisible(true);
		timer1.stop();
		slideMenu.show(this, 20, 20);
	}

	@Override public void mousePressed(MouseEvent e) {}
	@Override public void mouseReleased(MouseEvent e) {}
	@Override public void mouseEntered(MouseEvent e) {}
	@Override public void mouseExited(MouseEvent e) {}

	
	//  question  what about g.dispose ???? 
	//	
  //BufferedImage resizedImage = new BufferedImage(new_width, new_height, BufferedImage.TYPE_INT_ARGB); 
  //Graphics2D g = resizedImage.createGraphics();
  //g.drawImage(image, 0, 0, new_width, new_height, null);
  //g.dispose();
	
	@Override
	public void paintComponent(Graphics g) 
  { 
		
		setBackground(Color.black); // doesn't work after resizing 
		frame.setTitle(fimage.getFile().getAbsolutePath());
		int iW = fimage.getImage().getWidth();     // null pointer error
		int iH = fimage.getImage().getHeight();
		int pW = this.getWidth();
		int pH = this.getHeight();
		int offsetW = 0;               // horizontal offset of image 
		float newW, newH;
		
		float iratio= (float) iW / iH;
		float fratio= (float) pW / pH;
		
	
		if (iratio > fratio)  // image is proportionally wider than panel
		{
			newW = pW;												//  set display width equal to panel width
			newH = iH *  ((float) pW / iW);		// shorten height by same proportion as width
		} else {							// image is proportionally taller than the panel
			newH= pH;  
			newW = iW *  ((float) pH / iH);  
			offsetW = (pW - Math.round(newW)) / 2;
		}
		
    if (!g.drawImage(fimage.getImage(), offsetW, 0, Math.round(newW), Math.round(newH), null))
			 log.warning("draw failed");	
  } 
	
	public void back() {
		fimage=images.getPriorImage();
		repaint();
	}
	
  ActionListener timesUp = new ActionListener() {
			final Logger	log2 = Logger.getLogger( "slideshow.Gui");
		
			@Override
      public void actionPerformed(ActionEvent evt) {
				fimage=images.getRandomImage();      // occasional null point error!
				repaint();
      }
  };
	
  public void showSlides(Images2 images) 
  { 
		this.images=images;
    frame.add(new Gui2());
    frame.setSize(500, 400); 
		//frame.addComponentListener();
		fimage=images.getRandomImage();
		
		frame.setTitle(fimage.getFile().getName());  // null pointer
    frame.setVisible(true); 
  } 
}